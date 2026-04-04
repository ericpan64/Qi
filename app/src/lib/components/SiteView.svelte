<script>
  /**
   * @typedef {{ id: string, title: string, url: string | null }} Tab
   */

  /** @type {{ tab: Tab, reopen: () => void }} */
  let { tab, reopen } = $props();
</script>

<div class="site-view-placeholder">
  <div>
    <div class="site-title">{tab.title}</div>
    <div class="site-url-line">{tab.url}</div>
  </div>
  <p>
    Sites open in their own window. Use navigation shortcuts (Cmd/Ctrl+Left/Right) or reopen if
    needed.
  </p>
  <button onclick={reopen}>Focus / Open Site Window</button>
</div>
