<script>
  /**
   * @typedef {{ id: string, name: string, text: string }} SubTab
   */

  /** @type {{ subTabs: SubTab[], activeSubTabId: string | null, onSubTabsChange: (tabs: SubTab[]) => void, onActiveChange: (id: string) => void }} */
  let { subTabs, activeSubTabId, onSubTabsChange, onActiveChange } = $props();

  let activeTab = $derived(subTabs.find((t) => t.id === activeSubTabId));

  function addSubTab() {
    const newIndex = subTabs.length + 1;
    const id = `sub-${Date.now()}`;
    const updated = [...subTabs, { id, name: `_${newIndex}`, text: '' }];
    onSubTabsChange(updated);
    onActiveChange(id);
  }

  /** @param {string} id */
  function closeSubTab(id) {
    if (subTabs.length <= 1) return;
    const i = subTabs.findIndex((t) => t.id === id);
    if (i <= 0) return;

    const next = [...subTabs.slice(0, i), ...subTabs.slice(i + 1)];
    const renumbered = next.map((t, idx) => ({
      ...t,
      name: `_${idx + 1}`
    }));

    if (activeSubTabId === id) {
      const newActive = renumbered[i]?.id || renumbered[i - 1]?.id;
      onActiveChange(newActive);
    }

    onSubTabsChange(renumbered);
  }

  function handleClearAllTabs() {
    const initial = [{ id: 'sub-1', name: '_1', text: activeTab?.text || '' }];
    onSubTabsChange(initial);
    onActiveChange('sub-1');
  }

  function handleFormatJson() {
    try {
      const parsed = JSON.parse(activeTab?.text || '');
      const formatted = JSON.stringify(parsed, null, 2);
      const updated = subTabs.map((t) =>
        t.id === activeSubTabId ? { ...t, text: formatted } : t
      );
      onSubTabsChange(updated);
    } catch (e) {
      alert(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  /** @param {Event} e */
  function handleTextChange(e) {
    const newText = /** @type {HTMLTextAreaElement} */ (e.target).value;
    const updated = subTabs.map((t) =>
      t.id === activeSubTabId ? { ...t, text: newText } : t
    );
    onSubTabsChange(updated);
  }
</script>

<div class="scratch">
  <div class="scratch-toolbar">
    <button onclick={handleClearAllTabs}>Clear All Text Tabs</button>
    <button onclick={handleFormatJson}>Format JSON</button>
  </div>

  <div class="scratch-tabs">
    {#each subTabs as tab, idx (tab.id)}
      <div class="scratch-tab">
        <button
          onclick={() => onActiveChange(tab.id)}
          class="scratch-tab-label"
          class:active={tab.id === activeSubTabId}
          type="button"
          aria-selected={tab.id === activeSubTabId}
        >
          {tab.name}
        </button>
        {#if idx > 0}
          <button
            class="scratch-close"
            onclick={() => closeSubTab(tab.id)}
            type="button"
            aria-label={`Close ${tab.name}`}
          >
            x
          </button>
        {/if}
      </div>
    {/each}
    <button class="scratch-add" onclick={addSubTab} type="button" aria-label="Add new tab">
      +
    </button>
  </div>

  <textarea
    class="scratch-textarea"
    value={activeTab?.text || ''}
    oninput={handleTextChange}
    aria-label="Scratch pad text area"
  ></textarea>
</div>
