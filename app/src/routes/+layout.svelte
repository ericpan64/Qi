<script>
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { onMount } from 'svelte';
  import { getDomainFromUrl } from '$lib/utils/url';
  import TabBar from '$lib/components/TabBar.svelte';
  import Home from '$lib/components/Home.svelte';
  import ScratchPad from '$lib/components/ScratchPad.svelte';
  import '../app.css';

  /**
   * @typedef {{ url: string, name: string, logo: string, color: string }} Website
   * @typedef {{ id: string, title: string, url: string | null }} Tab
   * @typedef {{ id: string, name: string, text: string }} SubTab
   * @typedef {{ left_width_percent: number, right_width_percent: number, top_height_percent: number, bottom_height_percent: number }} WindowSizes
   */

  const DEFAULT_WINDOW_SIZES = {
    left_width_percent: 60,
    right_width_percent: 60,
    top_height_percent: 60,
    bottom_height_percent: 60
  };

  let websites = $state(/** @type {Website[]} */ ([]));
  let activeTab = $state('home');
  let windowSizes = $state(/** @type {WindowSizes} */ ({ ...DEFAULT_WINDOW_SIZES }));
  let error = $state(/** @type {string | null} */ (null));

  // Scratch pad state
  let subTabs = $state(/** @type {SubTab[]} */ ([{ id: 'sub-1', name: '_1', text: '' }]));
  let activeSubTabId = $state('sub-1');
  /** @type {ReturnType<typeof setTimeout> | null} */
  let saveTimeout = null;

  /** @param {Website[]} data */
  function buildTabs(data) {
    return [
      { id: 'home', title: 'Home', url: null },
      ...data.map((w, i) => ({
        id: `site-${i}`,
        title: w.name || getDomainFromUrl(w.url),
        url: w.url
      }))
    ];
  }

  let tabs = $derived(buildTabs(websites));
  let siteTabs = $derived(tabs.filter((t) => t.url));

  /** @param {string} scratchText */
  function initializeScratchTabs(scratchText) {
    try {
      const parsed = JSON.parse(scratchText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        subTabs = parsed;
        activeSubTabId = parsed[0]?.id;
        return;
      }
    } catch {
      // Fall through
    }
    subTabs = [{ id: 'sub-1', name: '_1', text: scratchText }];
    activeSubTabId = 'sub-1';
  }

  // Debounced auto-save for scratch tabs
  $effect(() => {
    // Access subTabs to track changes
    const current = JSON.stringify(subTabs);
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      invoke('set_scratch_text_cmd', { text: current });
    }, 500);

    return () => {
      if (saveTimeout) clearTimeout(saveTimeout);
    };
  });

  // Hide site webviews when switching to non-site tabs
  $effect(() => {
    if (!activeTab.startsWith('site-')) {
      invoke('hide_site_webviews_cmd');
    }
  });

  /** @param {Website} website @param {number} index */
  async function openSite(website, index) {
    activeTab = `site-${index}`;
    await invoke('open_site_cmd', { index });
  }

  /** @param {string} id */
  function handleTabClick(id) {
    activeTab = id;
    // If clicking a site tab, open its webview
    if (id.startsWith('site-')) {
      const index = parseInt(id.split('-')[1], 10);
      invoke('open_site_cmd', { index });
    }
  }

  onMount(() => {
    /** @type {Array<() => void>} */
    const cleanups = [];

    async function initialize() {
      try {
        const data = await invoke('get_websites');
        websites = /** @type {Website[]} */ (data);

        cleanups.push(
          await listen('websites-updated', (event) => {
            websites = /** @type {Website[]} */ (event.payload);
          })
        );

        cleanups.push(
          await listen('select-tab', (event) => {
            activeTab = /** @type {string} */ (event.payload);
          })
        );

        cleanups.push(
          await listen('reset-history', () => {
            activeTab = 'home';
          })
        );

        const sizes = await invoke('get_window_sizes_cmd');
        windowSizes = /** @type {WindowSizes} */ (sizes);

        cleanups.push(
          await listen('window-sizes-updated', (event) => {
            windowSizes = /** @type {WindowSizes} */ (event.payload);
          })
        );

        const scratchText = await invoke('get_scratch_text_cmd');
        initializeScratchTabs(/** @type {string} */ (scratchText));

        cleanups.push(
          await listen('scratch-text-updated', (event) => {
            initializeScratchTabs(/** @type {string} */ (event.payload));
          })
        );
      } catch (err) {
        console.error(err);
        error = err instanceof Error ? err.message : 'An error occurred';
      }
    }

    initialize();

    return () => {
      cleanups.forEach((fn) => fn());
    };
  });
</script>

<div class="app-shell">
  {#if error}
    <div class="error-toast">{error}</div>
  {/if}

  <TabBar {tabs} {activeTab} onTabClick={handleTabClick} />

  <div class="tab-body">
    <div style:display={activeTab === 'home' ? 'flex' : 'none'} style:flex="1">
      <Home {websites} {windowSizes} {openSite} />
    </div>

    <div
      style:display={activeTab === 'scratch' ? 'flex' : 'none'}
      style:flex="1"
      style:flex-direction="column"
      style:min-height="0"
    >
      <ScratchPad
        {subTabs}
        {activeSubTabId}
        onSubTabsChange={(tabs) => (subTabs = tabs)}
        onActiveChange={(id) => (activeSubTabId = id)}
      />
    </div>
  </div>
</div>
