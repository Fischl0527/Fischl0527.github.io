(function () {
  'use strict';

  if (window.__lfPortalPagesBooted) return;
  window.__lfPortalPagesBooted = true;

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.lf-open-search');
    if (!button) return;
    var searchTrigger = document.querySelector('#search-button > .search');
    if (searchTrigger) searchTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
})();
