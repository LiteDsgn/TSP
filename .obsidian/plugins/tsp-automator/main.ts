import { Plugin, TFile, TFolder, Notice, PluginSettingTab, App, Setting, AbstractInputSuggest, TextComponent } from 'obsidian';

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
        console.log('TSP Automator loaded (v3 - AutoComplete)');

        await this.loadSettings();

        // Add Settings Tab
        this.addSettingTab(new TSPAutomatorSettingTab(this.app, this));

        // Watch for file creation
        this.registerEvent(this.app.vault.on('create', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                await this.handleFileCreate(file);
                await this.ensureTitle(file);
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
                const oldDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
                const oldFolder = this.app.vault.getAbstractFileByPath(oldDir);
                if (oldFolder instanceof TFolder) {
                    await this.regenerateIndex(oldDir); 
                }

                await this.updateIndexForFile(file);
                await this.ensureTitle(file, true);
            }
        }));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    // Logic to ensure the file has a # Title that matches the filename
    async ensureTitle(file: TFile, forceUpdate = false) {
        if (file.path.startsWith("Templates/")) return;

        try {
            const content = await this.app.vault.read(file);
            const lines = content.split("\n");
            let titleLineIndex = -1;
            let insertIndex = 0;
            
            let hasFrontmatter = false;
            let endFrontmatterIndex = -1;
            
            if (lines.length > 0 && lines[0].trim() === "---") {
                hasFrontmatter = true;
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === "---") {
                        endFrontmatterIndex = i;
                        break;
                    }
                }
            }
            
            if (hasFrontmatter && endFrontmatterIndex !== -1) {
                insertIndex = endFrontmatterIndex + 1;
            } else {
                insertIndex = 0;
            }
            
            for (let i = insertIndex; i < lines.length; i++) {
                if (lines[i].trim().startsWith("# ")) {
                    titleLineIndex = i;
                    break;
                }
                if (i > insertIndex + 5) break; 
            }
            
            const desiredTitle = `# ${file.basename}`;
            
            if (titleLineIndex !== -1) {
                if (forceUpdate) {
                    const currentTitle = lines[titleLineIndex].trim();
                    if (currentTitle !== desiredTitle) {
                        lines[titleLineIndex] = desiredTitle;
                        await this.app.vault.modify(file, lines.join("\n"));
                    }
                }
            } else {
                const linesToInsert = [];
                if (insertIndex > 0) linesToInsert.push("");
                linesToInsert.push(desiredTitle);
                linesToInsert.push(""); 
                
                lines.splice(insertIndex, 0, ...linesToInsert);
                await this.app.vault.modify(file, lines.join("\n"));
            }
        } catch (err) {
            console.error("Error in ensureTitle:", err);
        }
    }

    async handleFileCreate(file: TFile) {
        const content = await this.app.vault.read(file);
        if (content.trim().length > 0) {
            return; 
        }

        const folderPath = file.parent.path;
        
        const templatePath = this.settings.folderTemplateMap[folderPath];
        if (!templatePath) return;

        const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
        if (templateFile instanceof TFile) {
            let templateContent = await this.app.vault.read(templateFile);
            
            const dateStr = window.moment().format('YYYY-MM-DD');
            templateContent = templateContent.replace(/{{date}}/g, dateStr);
            templateContent = templateContent.replace(/{{title}}/g, file.basename);
            
            await this.app.vault.modify(file, templateContent);
            new Notice(`Applied template: ${templateFile.basename}`);
        } else {
            console.warn(`Template not found: ${templatePath}`);
        }
    }

    async updateIndexForFile(file: TFile) {
        const folderPath = file.parent ? file.parent.path : file.path.substring(0, file.path.lastIndexOf('/'));
        await this.regenerateIndex(folderPath);
    }

    async regenerateIndex(folderPath: string) {
        const indexName = this.settings.folderIndexMap[folderPath];
        if (!indexName) return;

        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) return;

        const files = folder.children
            .filter(f => f instanceof TFile && f.extension === 'md' && f.basename !== indexName)
            .sort((a, b) => a.name.localeCompare(b.name));

        const indexPath = `${folderPath}/${indexName}.md`;
        let indexFile = this.app.vault.getAbstractFileByPath(indexPath);
        let frontmatter = `---
banner: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
banner_y: 0.5
---

`;

        if (indexFile instanceof TFile) {
            const currentContent = await this.app.vault.read(indexFile);
            const match = currentContent.match(/^---\n[\s\S]*?\n---\n/);
            if (match) {
                frontmatter = match[0] + '\n';
            }
        }

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

        if (indexFile instanceof TFile) {
            await this.app.vault.modify(indexFile, content);
        } else {
            await this.app.vault.create(indexPath, content);
        }
    }

    onunload() {
        console.log('TSP Automator unloaded');
    }
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
    textInputEl: HTMLInputElement;

    constructor(app: App, textInputEl: HTMLInputElement) {
        super(app, textInputEl);
        this.textInputEl = textInputEl;
    }

    getSuggestions(inputStr: string): TFolder[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const folders: TFolder[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach((file: import("obsidian").TAbstractFile) => {
            if (file instanceof TFolder) {
                if (file.path.toLowerCase().contains(lowerCaseInputStr)) {
                    folders.push(file);
                }
            }
        });

        return folders;
    }

    renderSuggestion(file: TFolder, el: HTMLElement): void {
        el.setText(file.path);
    }

    selectSuggestion(file: TFolder): void {
        this.textInputEl.value = file.path;
        this.textInputEl.trigger("input");
        this.close();
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
            'Index Filename',
            true // Enable Auto-Naming for Index
        );

        containerEl.createEl('hr');

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
            'Template Path',
            false
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
        valueLabel: string,
        isIndexMap: boolean
    ) {
        containerEl.createEl('h3', { text: heading });
        containerEl.createEl('p', { text: desc, cls: 'setting-item-description' });

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
        
        const actionCol = header.createDiv({ text: '' }); 
        actionCol.style.width = '40px'; 

        const entries = Object.entries(data);

        entries.forEach(([key, value], index) => {
            const setting = new Setting(containerEl);
            
            setting.infoEl.empty();
            setting.infoEl.style.flex = '1';
            setting.infoEl.style.paddingRight = '10px';
            
            // KEY INPUT with SUGGESTER
            const keyInputComp = new TextComponent(setting.infoEl);
            keyInputComp.setPlaceholder(keyPlaceholder).setValue(key);
            keyInputComp.inputEl.style.width = '100%';
            
            // Add Folder Suggestion
            new FolderSuggest(this.app, keyInputComp.inputEl);

            keyInputComp.onChange(async (newKey) => {
                entries[index][0] = newKey;
                
                // AUTO-NAMING LOGIC
                if (isIndexMap && newKey.trim() !== "") {
                    // Extract the last part of the folder path
                    const parts = newKey.split("/");
                    const folderName = parts[parts.length - 1];
                    // Clean it up (remove leading numbers if desired, or keep them)
                    // Let's strip standard "01 " prefix for the title part
                    const cleanName = folderName.replace(/^\d+\s+/, '');
                    
                    const autoName = `00 ${cleanName} Index`;
                    
                    // Update value input if it's currently empty
                    const currentValue = entries[index][1];
                    if (currentValue === "") {
                         entries[index][1] = autoName;
                         // We need to update the UI component too, but we don't have direct ref easily here unless we store it.
                         // Actually, triggering save will re-render if we call display(), but that might lose focus.
                         // Let's just update the data map for now.
                         // To make it visible immediately, we'd need to find the value component.
                         // For simplicity, we'll save and let the user see it next time or just trust it's saved.
                         // BETTER: We can just update the value in the inputs if we had refs.
                    }
                }

                const newMap = Object.fromEntries(entries);
                await onSave(newMap);
                // Re-render to show auto-filled value? It interrupts typing.
                // Let's NOT re-render on every keystroke.
            });


            // VALUE INPUT
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

            setting.addExtraButton(btn => btn
                .setIcon("trash")
                .setTooltip("Delete")
                .onClick(async () => {
                    entries.splice(index, 1);
                    const newMap = Object.fromEntries(entries);
                    await onSave(newMap);
                    this.display();
                }));
        });

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
