<script>
  /**
   * @typedef {{ id: string, title: string, url: string | null }} Tab
   */

  /** @type {{ tabs: Tab[], activeTab: string, onTabClick: (id: string) => void }} */
  let { tabs, activeTab, onTabClick } = $props();

  let siteTabs = $derived(tabs.filter((t) => t.url));

  /** @type {{ id: string, title: string, url: string | null, key: string }[]} */
  let sortedTabs = $derived([
    { id: 'scratch', title: '\u{1F5D2}\u{FE0F}', url: null, key: '`' },
    ...siteTabs.map((tab, i) => ({ ...tab, key: `${i + 1}` })),
    { id: 'home', title: '\u{1F3E1}', url: null, key: '0' }
  ]);
</script>

<div class="tab-bar">
  <div class="tab-list">
    {#each sortedTabs.filter((t) => t.id !== 'home') as tab (tab.id)}
      <button
        onclick={() => onTabClick(tab.id)}
        class="tab"
        class:active={tab.id === activeTab}
        type="button"
        aria-selected={tab.id === activeTab}
      >
        ({tab.key}) {tab.title}
      </button>
    {/each}
  </div>
  <button
    class="tab"
    class:active={activeTab === 'home'}
    onclick={() => onTabClick('home')}
    type="button"
    aria-selected={activeTab === 'home'}
  >
    (0) {'\u{1F3E1}'}
  </button>
</div>
