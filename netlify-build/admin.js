// Admin Dashboard JavaScript

class AdminDashboard {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.username = localStorage.getItem('username');
        this.isAdmin = localStorage.getItem('is_admin') === 'true';
        
        // Backend URL
        this.backendUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : 'https://rummikub-backend.onrender.com';
        
        this.currentDeleteTarget = null;
        
        // Initialize Socket.IO connection for online status tracking
        this.initSocket();
        
        this.init();
    }
    
    initSocket() {
        try {
            // Initialize Socket.IO connection with authentication
            this.socket = io(this.backendUrl, {
                auth: {
                    token: this.token
                },
                transports: ['websocket', 'polling']
            });
            
            this.socket.on('connect', () => {
                console.log('Admin dashboard connected to server');
                // Refresh user data when connected to get latest online status
                setTimeout(() => this.loadUsers(), 1000);
            });
            
            this.socket.on('disconnect', () => {
                console.log('Admin dashboard disconnected from server');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
        } catch (error) {
            console.error('Error initializing socket:', error);
        }
    }
    
    init() {
        // Check admin authentication
        if (!this.token || !this.isAdmin) {
            this.showNotification('Access denied. Admin privileges required.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        // Set admin username
        document.getElementById('adminUsername').textContent = this.username;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadDashboard();
        this.loadUsers();
        this.loadInvitations();
        
        // Auto-refresh user list every 30 seconds to update online status
        this.refreshInterval = setInterval(() => {
            if (this.currentTab === 'users') {
                this.loadUsers();
            }
        }, 30000);
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.nav-item').dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
        
        // Refresh buttons
        document.getElementById('refreshUsers')?.addEventListener('click', () => {
            this.loadUsers();
        });
        
        // Invitation form
        document.getElementById('sendInviteBtn').addEventListener('click', () => {
            this.toggleInviteForm(true);
        });
        
        document.getElementById('cancelInvite').addEventListener('click', () => {
            this.toggleInviteForm(false);
        });
        
        document.getElementById('invitationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendInvitation();
        });
        
        // Delete modal
        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.confirmDelete();
        });
        
        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.hideDeleteModal();
        });
    }
    
    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        // Load data based on tab
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'invitations':
                this.loadInvitations();
                break;
            case 'metrics':
                this.loadMetrics();
                break;
        }
    }
    
    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.backendUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }
    
    async loadDashboard() {
        try {
            const data = await this.apiRequest('/api/admin/stats');
            
            // Update overview stats
            document.getElementById('totalUsers').textContent = data.overview.totalUsers;
            document.getElementById('onlineUsers').textContent = data.overview.onlineUsers;
            document.getElementById('activeUsers').textContent = data.overview.activeUsers;
            document.getElementById('pendingInvitations').textContent = data.overview.pendingInvitations;
            
            // Update game stats
            document.getElementById('totalGames').textContent = data.gameStats.totalGamesPlayed || 0;
            document.getElementById('totalPlayTime').textContent = this.formatTime(data.gameStats.totalPlayTime || 0);
            document.getElementById('avgPoints').textContent = Math.round(data.gameStats.avgPointsPerGame || 0);
            
            // Update recent activity
            this.renderRecentActivity(data.recentActivity);
            
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showNotification('Failed to load dashboard data', 'error');
        }
    }
    
    async loadUsers() {
        try {
            const data = await this.apiRequest('/api/admin/users');
            this.renderUsers(data.users);
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showNotification('Failed to load users', 'error');
        }
    }
    
    async loadInvitations() {
        try {
            const data = await this.apiRequest('/api/admin/invitations');
            this.renderInvitations(data.invitations);
        } catch (error) {
            console.error('Failed to load invitations:', error);
            this.showNotification('Failed to load invitations', 'error');
        }
    }
    
    async loadMetrics() {
        try {
            const data = await this.apiRequest('/api/admin/stats');
            this.renderTopPlayers(data.topPlayers);
            this.renderRegistrationChart(data.userRegistrations);
        } catch (error) {
            console.error('Failed to load metrics:', error);
            this.showNotification('Failed to load metrics', 'error');
        }
    }
    
    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h4>${user.username}</h4>
                            <p>${user.isAdmin ? 'Admin' : 'User'}</p>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="status-badge ${user.isCurrentlyOnline ? 'status-online' : 'status-offline'}">
                        ${user.isCurrentlyOnline ? 'Online' : 'Offline'}
                    </span>
                </td>
                <td>${this.formatDate(user.lastSeen)}</td>
                <td>
                    <strong>${user.stats.gamesPlayed}</strong> played<br>
                    <small>${user.stats.gamesWon} wins (${Math.round(user.stats.winPercentage)}%)</small>
                </td>
                <td>${this.formatDate(user.createdAt)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="adminDashboard.deleteUser('${user._id}', '${user.username}')" 
                            ${user._id === this.getCurrentUserId() ? 'disabled title="Cannot delete yourself"' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    renderInvitations(invitations) {
        const tbody = document.getElementById('invitationsTableBody');
        
        if (!invitations || invitations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No invitations found</td></tr>';
            return;
        }
        
        const baseUrl = window.location.origin;
        
        tbody.innerHTML = invitations.map(invitation => `
            <tr>
                <td>${invitation.email}</td>
                <td>${invitation.invitedBy?.username || 'Unknown'}</td>
                <td>
                    <span class="status-badge status-${invitation.status}">
                        ${invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                    </span>
                </td>
                <td>${this.formatDate(invitation.sentAt)}</td>
                <td>${this.formatDate(invitation.expiresAt)}</td>
                <td>
                    ${invitation.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="adminDashboard.copyInvitationLink('${invitation.token}')" title="Copy invitation link">
                            <i class="fas fa-copy"></i> Copy Link
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="adminDashboard.cancelInvitation('${invitation._id}', '${invitation.email}')" title="Cancel invitation">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    }

    copyInvitationLink(token) {
        const baseUrl = window.location.origin;
        const invitationLink = `${baseUrl}/signup.html?token=${token}`;
        this.copyToClipboard(invitationLink);
    }
    
    renderRecentActivity(activity) {
        const container = document.getElementById('recentActivity');
        
        if (!activity || activity.length === 0) {
            container.innerHTML = '<div class="loading">No recent activity</div>';
            return;
        }
        
        container.innerHTML = activity.map(user => `
            <div class="activity-item">
                <span>${user.username}</span>
                <small>${this.formatDate(user.lastLogin)}</small>
            </div>
        `).join('');
    }
    
    renderTopPlayers(players) {
        const container = document.getElementById('topPlayersList');
        
        if (!players || players.length === 0) {
            container.innerHTML = '<div class="loading">No player data</div>';
            return;
        }
        
        container.innerHTML = players.map((player, index) => `
            <div class="player-item">
                <div>
                    <span class="player-rank">#${index + 1}</span>
                    <span class="player-name">${player.username}</span>
                </div>
                <div class="player-stats">
                    ${player.gamesWon} wins (${Math.round(player.winPercentage)}%)
                </div>
            </div>
        `).join('');
    }
    
    renderRegistrationChart(registrations) {
        const container = document.getElementById('registrationChart');
        
        if (!registrations || registrations.length === 0) {
            container.innerHTML = '<div class="loading">No registration data</div>';
            return;
        }
        
        // Simple text-based chart for now
        const maxCount = Math.max(...registrations.map(r => r.count));
        
        container.innerHTML = `
            <div style="font-size: 0.875rem;">
                <h4 style="margin-bottom: 1rem;">Last 30 Days</h4>
                ${registrations.slice(-7).map(reg => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>${reg._id}</span>
                        <span><strong>${reg.count}</strong> registrations</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    async sendInvitation() {
        const email = document.getElementById('inviteEmail').value;
        const message = document.getElementById('inviteMessage').value;
        
        if (!email) {
            this.showNotification('Email is required', 'error');
            return;
        }
        
        try {
            const response = await this.apiRequest('/api/admin/invitations', {
                method: 'POST',
                body: JSON.stringify({ email, message })
            });
            
            // Show invitation link
            const baseUrl = window.location.origin;
            const invitationLink = `${baseUrl}/signup.html?token=${response.invitation.token}`;
            
            this.showInvitationLink(invitationLink, email);
            this.toggleInviteForm(false);
            this.loadInvitations();
            this.loadDashboard(); // Refresh stats
        } catch (error) {
            this.showNotification('Failed to send invitation', 'error');
        }
    }

    showInvitationLink(link, email) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-link"></i> Invitation Created</h3>
                </div>
                <div class="modal-body">
                    <p>Invitation link for <strong>${email}</strong>:</p>
                    <div class="invitation-link-container">
                        <input type="text" value="${link}" readonly class="invitation-link-input" id="invitationLinkInput">
                        <button class="btn btn-primary btn-sm" onclick="adminDashboard.copyToClipboard('${link}')">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <p class="text-muted">Share this link with the person you want to invite. The link will expire in 7 days.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Auto-select the link for easy copying
        const linkInput = document.getElementById('invitationLinkInput');
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Link copied to clipboard!', 'success');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Link copied to clipboard!', 'success');
        }
    }
    
    async deleteUser(userId, username) {
        this.currentDeleteTarget = { type: 'user', id: userId };
        this.showDeleteModal(`Are you sure you want to delete user "${username}"? This action cannot be undone.`);
    }
    
    async cancelInvitation(invitationId, email) {
        this.currentDeleteTarget = { type: 'invitation', id: invitationId };
        this.showDeleteModal(`Are you sure you want to cancel the invitation to "${email}"?`);
    }
    
    async confirmDelete() {
        if (!this.currentDeleteTarget) return;
        
        try {
            const { type, id } = this.currentDeleteTarget;
            
            if (type === 'user') {
                await this.apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
                this.showNotification('User deleted successfully', 'success');
                this.loadUsers();
            } else if (type === 'invitation') {
                await this.apiRequest(`/api/admin/invitations/${id}`, { method: 'DELETE' });
                this.showNotification('Invitation cancelled successfully', 'success');
                this.loadInvitations();
            }
            
            this.loadDashboard(); // Refresh stats
            this.hideDeleteModal();
        } catch (error) {
            this.showNotification('Failed to delete item', 'error');
        }
    }
    
    toggleInviteForm(show) {
        const form = document.getElementById('inviteForm');
        if (show) {
            form.style.display = 'block';
            document.getElementById('inviteEmail').focus();
        } else {
            form.style.display = 'none';
            document.getElementById('invitationForm').reset();
        }
    }
    
    showDeleteModal(message) {
        document.getElementById('deleteMessage').textContent = message;
        document.getElementById('deleteModal').classList.add('show');
    }
    
    hideDeleteModal() {
        document.getElementById('deleteModal').classList.remove('show');
        this.currentDeleteTarget = null;
    }
    
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }
    
    formatTime(seconds) {
        if (!seconds) return '0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
    
    getCurrentUserId() {
        // Get current user ID from JWT token
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.id;
        } catch (error) {
            return null;
        }
    }
    
    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('username');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('is_admin');
        
        this.showNotification('Logged out successfully', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

// Initialize admin dashboard
const adminDashboard = new AdminDashboard();

// Auto-refresh data every 30 seconds
setInterval(() => {
    const activeTab = document.querySelector('.nav-item.active').dataset.tab;
    
    switch(activeTab) {
        case 'dashboard':
            adminDashboard.loadDashboard();
            break;
        case 'users':
            adminDashboard.loadUsers();
            break;
        case 'invitations':
            adminDashboard.loadInvitations();
            break;
    }
}, 30000);
