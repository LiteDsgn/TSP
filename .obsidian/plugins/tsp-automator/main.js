/*
THIS IS A BUNDLED FILE.
Modified to include Auto-Title Management and Folder Suggestion UI.
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TSPAutomator
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
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
var TSPAutomator = class extends import_obsidian.Plugin {
  async onload() {
    console.log("TSP Automator loaded (v3 - AutoComplete)");
    await this.loadSettings();
    this.addSettingTab(new TSPAutomatorSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on("create", async (file) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        await this.handleFileCreate(file);
        await this.ensureTitle(file);
        await this.updateIndexForFile(file);
      }
    }));
    this.registerEvent(this.app.vault.on("delete", async (file) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        await this.updateIndexForFile(file);
      }
    }));
    this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        const oldDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
        const oldFolder = this.app.vault.getAbstractFileByPath(oldDir);
        if (oldFolder instanceof import_obsidian.TFolder) {
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
  async ensureTitle(file, forceUpdate = false) {
    if (file.path.startsWith("Templates/"))
      return;
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
        if (i > insertIndex + 5)
          break;
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
        if (insertIndex > 0)
          linesToInsert.push("");
        linesToInsert.push(desiredTitle);
        linesToInsert.push("");
        lines.splice(insertIndex, 0, ...linesToInsert);
        await this.app.vault.modify(file, lines.join("\n"));
      }
    } catch (err) {
      console.error("Error in ensureTitle:", err);
    }
  }
  async handleFileCreate(file) {
    const content = await this.app.vault.read(file);
    if (content.trim().length > 0) {
      return;
    }
    const folderPath = file.parent.path;
    const templatePath = this.settings.folderTemplateMap[folderPath];
    if (!templatePath)
      return;
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (templateFile instanceof import_obsidian.TFile) {
      let templateContent = await this.app.vault.read(templateFile);
      const dateStr = window.moment().format("YYYY-MM-DD");
      templateContent = templateContent.replace(/{{date}}/g, dateStr);
      templateContent = templateContent.replace(/{{title}}/g, file.basename);
      await this.app.vault.modify(file, templateContent);
      new import_obsidian.Notice(`Applied template: ${templateFile.basename}`);
    } else {
      console.warn(`Template not found: ${templatePath}`);
    }
  }
  async updateIndexForFile(file) {
    const folderPath = file.parent ? file.parent.path : file.path.substring(0, file.path.lastIndexOf("/"));
    await this.regenerateIndex(folderPath);
  }
  async regenerateIndex(folderPath) {
    const indexName = this.settings.folderIndexMap[folderPath];
    if (!indexName)
      return;
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof import_obsidian.TFolder))
      return;
    const files = folder.children.filter((f) => f instanceof import_obsidian.TFile && f.extension === "md" && f.basename !== indexName).sort((a, b) => a.name.localeCompare(b.name));
    const indexPath = `${folderPath}/${indexName}.md`;
    let indexFile = this.app.vault.getAbstractFileByPath(indexPath);
    let frontmatter = `---
banner: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
banner_y: 0.5
---

`;
    if (indexFile instanceof import_obsidian.TFile) {
      const currentContent = await this.app.vault.read(indexFile);
      const match = currentContent.match(/^---\n[\s\S]*?\n---\n/);
      if (match) {
        frontmatter = match[0] + "\n";
      }
    }
    const displayTitle = indexName.replace(/^\d+\s+/, "");
    let content = frontmatter;
    content += `# \u{1F4C2} ${displayTitle}

`;
    content += `**Location:** \`${folderPath}\`

`;
    content += `---

`;
    if (files.length === 0) {
      content += `*No files found in this section yet.*
`;
    } else {
      files.forEach((f) => {
        if (f instanceof import_obsidian.TFile) {
          content += `- [[${f.basename}]]
`;
        }
      });
    }
    content += `
---
`;
    content += `[[Home Dashboard|\u{1F3E0} Back to Dashboard]]`;
    if (indexFile instanceof import_obsidian.TFile) {
      await this.app.vault.modify(indexFile, content);
    } else {
      await this.app.vault.create(indexPath, content);
    }
  }
  onunload() {
    console.log("TSP Automator unloaded");
  }
};
var FolderSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, textInputEl) {
    super(app, textInputEl);
    this.textInputEl = textInputEl;
  }
  getSuggestions(inputStr) {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const folders = [];
    const lowerCaseInputStr = inputStr.toLowerCase();
    abstractFiles.forEach((file) => {
      if (file instanceof import_obsidian.TFolder) {
        if (file.path.toLowerCase().contains(lowerCaseInputStr)) {
          folders.push(file);
        }
      }
    });
    return folders;
  }
  renderSuggestion(file, el) {
    el.setText(file.path);
  }
  selectSuggestion(file) {
    this.textInputEl.value = file.path;
    this.textInputEl.trigger("input");
    this.close();
  }
};
var TSPAutomatorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TSP Automator Settings" });
    this.renderMapSettings(containerEl, "Folder Index Map", "Map specific folders to their Index filenames.", this.plugin.settings.folderIndexMap, async (newMap) => {
      this.plugin.settings.folderIndexMap = newMap;
      await this.plugin.saveSettings();
    }, "Folder Path (e.g. 01 Projects)", "Index Name (e.g. Projects Index)", "Folder Path", "Index Filename", true);
    containerEl.createEl("hr");
    this.renderMapSettings(containerEl, "Folder Template Map", "Map folders to the template applied to new files inside them.", this.plugin.settings.folderTemplateMap, async (newMap) => {
      this.plugin.settings.folderTemplateMap = newMap;
      await this.plugin.saveSettings();
    }, "Folder Path (e.g. 01 Projects)", "Template Path (e.g. Templates/Note.md)", "Folder Path", "Template Path", false);
  }
  renderMapSettings(containerEl, heading, desc, data, onSave, keyPlaceholder, valuePlaceholder, keyLabel, valueLabel, isIndexMap) {
    containerEl.createEl("h3", { text: heading });
    containerEl.createEl("p", { text: desc, cls: "setting-item-description" });
    const header = containerEl.createDiv({ cls: "setting-item tsp-header-row" });
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.paddingTop = "0";
    header.style.paddingBottom = "5px";
    header.style.borderBottom = "1px solid var(--background-modifier-border)";
    header.style.marginBottom = "10px";
    const infoCol = header.createDiv({ text: keyLabel });
    infoCol.style.flex = "1";
    infoCol.style.fontWeight = "bold";
    infoCol.style.color = "var(--text-muted)";
    infoCol.style.fontSize = "0.8em";
    infoCol.style.textTransform = "uppercase";
    const valueCol = header.createDiv({ text: valueLabel });
    valueCol.style.flex = "1";
    valueCol.style.fontWeight = "bold";
    valueCol.style.color = "var(--text-muted)";
    valueCol.style.fontSize = "0.8em";
    valueCol.style.textTransform = "uppercase";
    const actionCol = header.createDiv({ text: "" });
    actionCol.style.width = "40px";
    const entries = Object.entries(data);
    entries.forEach(([key, value], index) => {
      const setting = new import_obsidian.Setting(containerEl);
      setting.infoEl.empty();
      setting.infoEl.style.flex = "1";
      setting.infoEl.style.paddingRight = "10px";
      const keyInputComp = new import_obsidian.TextComponent(setting.infoEl);
      keyInputComp.setPlaceholder(keyPlaceholder).setValue(key);
      keyInputComp.inputEl.style.width = "100%";
      new FolderSuggest(this.app, keyInputComp.inputEl);
      keyInputComp.onChange(async (newKey) => {
        entries[index][0] = newKey;
        if (isIndexMap && newKey.trim() !== "") {
          const parts = newKey.split("/");
          const folderName = parts[parts.length - 1];
          const cleanName = folderName.replace(/^\d+\s+/, "");
          const autoName = `00 ${cleanName} Index`;
          const currentValue = entries[index][1];
          if (currentValue === "") {
            entries[index][1] = autoName;
          }
        }
        const newMap = Object.fromEntries(entries);
        await onSave(newMap);
      });
      setting.controlEl.style.flex = "1";
      setting.controlEl.style.justifyContent = "flex-start";
      const valueInput = new import_obsidian.TextComponent(setting.controlEl).setPlaceholder(valuePlaceholder).setValue(value).onChange(async (newValue) => {
        entries[index][1] = newValue;
        const newMap = Object.fromEntries(entries);
        await onSave(newMap);
      });
      valueInput.inputEl.style.width = "100%";
      setting.addExtraButton((btn) => btn.setIcon("trash").setTooltip("Delete").onClick(async () => {
        entries.splice(index, 1);
        const newMap = Object.fromEntries(entries);
        await onSave(newMap);
        this.display();
      }));
    });
    new import_obsidian.Setting(containerEl).addButton((btn) => btn.setButtonText("Add New Mapping").onClick(async () => {
      entries.push(["", ""]);
      const newMap = Object.fromEntries(entries);
      await onSave(newMap);
      this.display();
    }));
  }
};
