function switchTab(tabName) {
    // 1. Update Buttons
    const buttons = document.querySelectorAll('.nav-item');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // 2. Clear and Update Content
    const hub = document.getElementById('vermeer-alerts');
    hub.innerHTML = `<div class="loading">SYNCING ${tabName.toUpperCase()}...</div>`;
    
    // In a future step, we will point these to different API endpoints
    if (tabName === 'hub') {
        loadData();
    } else {
        hub.innerHTML = `<div class="loading" style="color: #666;">${tabName.toUpperCase()} DATA STREAM PENDING...</div>`;
    }
}
