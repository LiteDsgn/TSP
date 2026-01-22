import { Plugin, TFile, TFolder, Notice, PluginSettingTab, App, Setting, TextComponent } from 'obsidian';

// CONFIGURATION INTERFACE
interface TSPAutomatorSettings {
    folderIndexMap: Record<string, string>;
    folderTemplateMap: Record<string, string>;
}

const DEFAULT_SETTINGS: TSPAutomatorSettings = {
    folderIndexMap: {
        "01 Projects/Website Articles": "00 Website Articles Index",
        "01 Projects/Social Media Threads": "00 Social Media Index",
        "01 Projects/Books": "00 Books Index",
        "02 Areas/Family": "00 Family Index",
        "02 Areas/Ministry": "00 Ministry Index",
        "02 Areas/Admin": "00 Admin Index",
        "03 Resources/People": "00 People Index",
        "03 Resources/Theology": "00 Theology Index",
        "03 Resources/Philosophy": "00 Philosophy Index",
        "03 Resources/Glossary": "00 Hebrew Word Studies Index",
        "04 Archives/To Sort": "00 To Sort Index",
        "04 Archives/Evernote Import": "00 Evernote Archive Index"
    },
    folderTemplateMap: {
        "01 Projects/Website Articles": "Templates/New Website Article.md",
        "01 Projects/Social Media Threads": "Templates/New Social Thread.md",
        "01 Projects/Books": "Templates/New Book Chapter.md",
        "03 Resources/People": "Templates/New Person.md",
        "03 Resources/Theology": "Templates/New Theology Note.md",
        "03 Resources/Philosophy": "Templates/New Philosophy Note.md",
        "03 Resources/Glossary": "Templates/New Hebrew Word.md"
    }
};

export default class TSPAutomator extends Plugin {
    settings: TSPAutomatorSettings;

    async onload() {
        console.log('TSP Automator loaded');

        await this.loadSettings();

        // Add Settings Tab
        this.addSettingTab(new TSPAutomatorSettingTab(this.app, this));

        // Watch for file creation
        this.registerEvent(this.app.vault.on('create', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                await this.handleFileCreate(file);
                await this.updateIndexForFile(file);
            }
        }));

        // Watch for file deletion
        this.registerEvent(this.app.vault.on('delete', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                await this.updateIndexForFile(file);
            }
        }));

        // Watch for file rename/move
        this.registerEvent(this.app.vault.on('rename', async (file, oldPath) => {
            if (file instanceof TFile && file.extension === 'md') {
                // Update index for OLD path (remove)
                // We need to figure out the old folder.
                const oldDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
                const oldFolder = this.app.vault.getAbstractFileByPath(oldDir);
                if (oldFolder instanceof TFolder) {
                    await this.regenerateIndex(oldDir); 
                }

                // Update index for NEW path (add)
                await this.updateIndexForFile(file);
            }
        }));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async handleFileCreate(file: TFile) {
        // 1. Check if file is empty
        const content = await this.app.vault.read(file);
        if (content.trim().length > 0) {
            return; // File not empty, skip template
        }

        // 2. Determine folder
        const folderPath = file.parent.path;
        
        // 3. Check for template
        const templatePath = this.settings.folderTemplateMap[folderPath];
        if (!templatePath) return;

        const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
        if (templateFile instanceof TFile) {
            let templateContent = await this.app.vault.read(templateFile);
            
            // 4. Replacements
            const dateStr = window.moment().format('YYYY-MM-DD');
            templateContent = templateContent.replace(/{{date}}/g, dateStr);
            templateContent = templateContent.replace(/{{title}}/g, file.basename);
            
            // 5. Apply
            await this.app.vault.modify(file, templateContent);
            new Notice(`Applied template: ${templateFile.basename}`);
        } else {
            console.warn(`Template not found: ${templatePath}`);
        }
    }

    async updateIndexForFile(file: TFile) {
        // If file is deleted, file.parent might be null, need to handle that context.
        // Actually, for delete event, 'file' object still has path properties usually, 
        // but 'parent' might be tricky if the folder was deleted. 
        // But usually we delete files inside folders.
        
        // Ideally we just regenerate the index for the folder involved.
        const folderPath = file.parent ? file.parent.path : file.path.substring(0, file.path.lastIndexOf('/'));
        await this.regenerateIndex(folderPath);
    }

    async regenerateIndex(folderPath: string) {
        // Check if this folder needs indexing
        const indexName = this.settings.folderIndexMap[folderPath];
        if (!indexName) return;

        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) return;

        // Get all MD files in folder
        const files = folder.children
            .filter(f => f instanceof TFile && f.extension === 'md' && f.basename !== indexName)
            .sort((a, b) => a.name.localeCompare(b.name));

        // Prepare Frontmatter
        const indexPath = `${folderPath}/${indexName}.md`;
        let indexFile = this.app.vault.getAbstractFileByPath(indexPath);
        let frontmatter = `---
banner: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
banner_y: 0.5
---\n\n`;

        // If file exists, try to preserve existing frontmatter
        if (indexFile instanceof TFile) {
            const currentContent = await this.app.vault.read(indexFile);
            const match = currentContent.match(/^---\n[\s\S]*?\n---\n/);
            if (match) {
                frontmatter = match[0] + '\n';
                // Check if banner exists in preserved frontmatter, if not, we might want to add it?
                // For now, let's assume if frontmatter exists, the user manages it, or we insert it if missing?
                // To be safe/simple: We just preserve whatever is there. 
                // If the user wants to add a banner, they will add it and we won't delete it.
                // But if we want to enforce banners on existing files that have frontmatter but no banner, that's complex parsing.
                // Let's stick to: Preserve if exists. Use default if new/no frontmatter.
            } else {
                 // No frontmatter found, use default with banner
            }
        }

        // Generate Content
        // Strip leading digits and space (e.g. "00 ") for display title
        const displayTitle = indexName.replace(/^\d+\s+/, '');
        let content = frontmatter;
        content += `# 📂 ${displayTitle}\n\n`;
        content += `**Location:** \`${folderPath}\`\n\n`;
        content += `---\n\n`;

        if (files.length === 0) {
            content += `*No files found in this section yet.*\n`;
        } else {
            files.forEach(f => {
                if (f instanceof TFile) {
                    content += `- [[${f.basename}]]\n`;
                }
            });
        }

        content += `\n---\n`;
        content += `[[Home Dashboard|🏠 Back to Dashboard]]`;

        // Write Index File
        if (indexFile instanceof TFile) {
            await this.app.vault.modify(indexFile, content);
        } else {
            await this.app.vault.create(indexPath, content);
        }
        
        // console.log(`Updated index: ${indexPath}`);
    }

    onunload() {
        console.log('TSP Automator unloaded');
    }
}

class TSPAutomatorSettingTab extends PluginSettingTab {
    plugin: TSPAutomator;

    constructor(app: App, plugin: TSPAutomator) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'TSP Automator Settings' });

        // Section 1: Folder Index Map
        this.renderMapSettings(
            containerEl,
            'Folder Index Map',
            'Map specific folders to their Index filenames.',
            this.plugin.settings.folderIndexMap,
            async (newMap) => {
                this.plugin.settings.folderIndexMap = newMap;
                await this.plugin.saveSettings();
            },
            'Folder Path (e.g. 01 Projects)',
            'Index Name (e.g. Projects Index)',
            'Folder Path',
            'Index Filename'
        );

        containerEl.createEl('hr');

        // Section 2: Folder Template Map
        this.renderMapSettings(
            containerEl,
            'Folder Template Map',
            'Map folders to the template applied to new files inside them.',
            this.plugin.settings.folderTemplateMap,
            async (newMap) => {
                this.plugin.settings.folderTemplateMap = newMap;
                await this.plugin.saveSettings();
            },
            'Folder Path (e.g. 01 Projects)',
            'Template Path (e.g. Templates/Note.md)',
            'Folder Path',
            'Template Path'
        );
    }

    renderMapSettings(
        containerEl: HTMLElement, 
        heading: string, 
        desc: string,
        data: Record<string, string>, 
        onSave: (newData: Record<string, string>) => Promise<void>,
        keyPlaceholder: string,
        valuePlaceholder: string,
        keyLabel: string,
        valueLabel: string
    ) {
        containerEl.createEl('h3', { text: heading });
        containerEl.createEl('p', { text: desc, cls: 'setting-item-description' });

        // Header Row
        const header = containerEl.createDiv({ cls: 'setting-item tsp-header-row' });
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.paddingTop = '0';
        header.style.paddingBottom = '5px';
        header.style.borderBottom = '1px solid var(--background-modifier-border)';
        header.style.marginBottom = '10px';

        const infoCol = header.createDiv({ text: keyLabel });
        infoCol.style.flex = '1';
        infoCol.style.fontWeight = 'bold';
        infoCol.style.color = 'var(--text-muted)';
        infoCol.style.fontSize = '0.8em';
        infoCol.style.textTransform = 'uppercase';

        const valueCol = header.createDiv({ text: valueLabel });
        valueCol.style.flex = '1';
        valueCol.style.fontWeight = 'bold';
        valueCol.style.color = 'var(--text-muted)';
        valueCol.style.fontSize = '0.8em';
        valueCol.style.textTransform = 'uppercase';
        
        // Spacer for delete button
        const actionCol = header.createDiv({ text: '' }); 
        actionCol.style.width = '40px'; 

        const entries = Object.entries(data);

        entries.forEach(([key, value], index) => {
            const setting = new Setting(containerEl);
            
            // Clear default info (name/desc) and inject Key Input
            setting.infoEl.empty();
            setting.infoEl.style.flex = '1';
            setting.infoEl.style.paddingRight = '10px';
            
            const keyInput = new TextComponent(setting.infoEl)
                .setPlaceholder(keyPlaceholder)
                .setValue(key)
                .onChange(async (newKey) => {
                    entries[index][0] = newKey;
                    const newMap = Object.fromEntries(entries);
                    await onSave(newMap);
                });
            keyInput.inputEl.style.width = '100%';

            // Value Input in Control
            // setting.controlEl is usually flex-end. We want it to take space.
            setting.controlEl.style.flex = '1';
            setting.controlEl.style.justifyContent = 'flex-start';

            const valueInput = new TextComponent(setting.controlEl)
                .setPlaceholder(valuePlaceholder)
                .setValue(value)
                .onChange(async (newValue) => {
                    entries[index][1] = newValue;
                    const newMap = Object.fromEntries(entries);
                    await onSave(newMap);
                });
            valueInput.inputEl.style.width = '100%';

            // Delete Button
            setting.addExtraButton(btn => btn
                .setIcon("trash")
                .setTooltip("Delete")
                .onClick(async () => {
                    entries.splice(index, 1);
                    const newMap = Object.fromEntries(entries);
                    await onSave(newMap);
                    // Force refresh to remove the row
                    this.display();
                }));
        });

        // Add New Button
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText("Add New Mapping")
                .onClick(async () => {
                    entries.push(["", ""]);
                    const newMap = Object.fromEntries(entries);
                    await onSave(newMap);
                    this.display();
                }));
    }
}
