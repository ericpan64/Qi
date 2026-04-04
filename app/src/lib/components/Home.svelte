<script>
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { onMount } from 'svelte';
  import { getDomainFromUrl, getFaviconUrl, ensureProtocol } from '$lib/utils/url';

  /**
   * @typedef {{ url: string, name: string, logo: string, color: string }} Website
   * @typedef {{ left_width_percent: number, right_width_percent: number, top_height_percent: number, bottom_height_percent: number }} WindowSizes
   */

  /** @type {{ websites: Website[], windowSizes: WindowSizes, openSite: (website: Website, index: number) => void }} */
  let { websites, windowSizes, openSite } = $props();

  let addFormOpen = $state(false);
  let addUrl = $state('');
  let addName = $state('');
  let error = $state(/** @type {string | null} */ (null));
  let draggedIndex = $state(/** @type {number | null} */ (null));

  // Local copy of window sizes for editing
  let localSizes = $state(/** @type {WindowSizes} */ ({ ...windowSizes }));

  // Sync local sizes when prop changes
  $effect(() => {
    localSizes = /** @type {WindowSizes} */ ({ ...windowSizes });
  });

  onMount(() => {
    const unlisten = listen('website-validation-error', (event) => {
      error = /** @type {string} */ (event.payload);
      setTimeout(() => (error = null), 4000);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  });

  async function submitAdd() {
    if (!addUrl) {
      error = 'Please enter a URL';
      return;
    }
    const urlToSend = ensureProtocol(addUrl);
    await invoke('add_website_cmd', {
      website: {
        url: urlToSend,
        name: addName || getDomainFromUrl(urlToSend)
      }
    });
    addFormOpen = false;
    addUrl = '';
    addName = '';
  }

  /** @param {number} index */
  async function removeSite(index) {
    await invoke('remove_website_cmd', { index });
  }

  /** @param {DragEvent} e @param {number} index */
  function handleDragStart(e, index) {
    draggedIndex = index;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  /** @param {DragEvent} e */
  function handleDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  /** @param {DragEvent} e @param {number} index */
  async function handleDrop(e, index) {
    e.preventDefault();
    if (draggedIndex === null) return;
    const newOrder = [...websites];
    const [moved] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, moved);
    await invoke('reorder_websites_cmd', { websites: newOrder });
    draggedIndex = null;
  }

  /** @param {Event} e */
  function handleSizeChange(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const { name, value } = target;
    localSizes = { ...localSizes, [name]: Number(value) };
  }

  async function handleSaveSizes() {
    await invoke('save_window_sizes_cmd', { sizes: localSizes });
  }
</script>

<div class="home">
  {#if error}
    <div class="error-inline">{error}</div>
  {/if}

  {#if addFormOpen}
    <div class="add-form">
      <input bind:value={addUrl} placeholder="https://example.com" />
      <input bind:value={addName} placeholder="Display name (optional)" />
      <button onclick={submitAdd}>Save</button>
      <button onclick={() => { addFormOpen = false; addUrl = ''; addName = ''; }}>Cancel</button>
    </div>
  {:else}
    <div class="add-row">
      <button onclick={() => (addFormOpen = true)}>Add Website</button>
    </div>
  {/if}

  {#if websites.length === 0}
    <div class="empty-state">
      <h2>No websites added yet</h2>
      <p>Start by adding your favorite websites using the button above.</p>
    </div>
  {:else}
    <div class="websites-grid">
      {#each websites as website, index (website.url)}
        <div
          class="website-card"
          draggable="true"
          ondragstart={(e) => handleDragStart(e, index)}
          ondragover={handleDragOver}
          ondrop={(e) => handleDrop(e, index)}
          ondragend={() => (draggedIndex = null)}
          onclick={() => openSite(website, index)}
          role="button"
          tabindex="0"
        >
          <button
            class="remove-btn"
            onclick={(e) => { e.stopPropagation(); removeSite(index); }}
            title="Remove website"
            aria-label={`Remove ${website.name}`}
          >
            x
          </button>
          <img
            class="logo"
            src={website.logo || getFaviconUrl(website.url)}
            alt={website.name}
          />
          <div class="site-name">{website.name || getDomainFromUrl(website.url)}</div>
          <div class="site-url">{getDomainFromUrl(website.url)}</div>
          {#if index < 9}
            <div class="keyboard-shortcut">Ctrl/Cmd+{index + 1}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="window-size-panel">
    <h3>Window-size settings</h3>
    <div class="window-grid">
      <label>
        Left width %
        <input
          type="number"
          name="left_width_percent"
          value={localSizes.left_width_percent}
          oninput={handleSizeChange}
          min="0"
          max="100"
        />
      </label>
      <label>
        Right width %
        <input
          type="number"
          name="right_width_percent"
          value={localSizes.right_width_percent}
          oninput={handleSizeChange}
          min="0"
          max="100"
        />
      </label>
      <label>
        Top height %
        <input
          type="number"
          name="top_height_percent"
          value={localSizes.top_height_percent}
          oninput={handleSizeChange}
          min="0"
          max="100"
        />
      </label>
      <label>
        Bottom height %
        <input
          type="number"
          name="bottom_height_percent"
          value={localSizes.bottom_height_percent}
          oninput={handleSizeChange}
          min="0"
          max="100"
        />
      </label>
    </div>
    <button onclick={handleSaveSizes} class="save-btn">Save</button>
  </div>
</div>
