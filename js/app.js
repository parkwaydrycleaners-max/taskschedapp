
        // Task Scheduler Application
        class TaskSchedulerApp {
            constructor() {
                // Core state
                this.currentDate = new Date();
                this.viewDays = 2;
                this.people = [];
                this.peopleCapacity = {};
                this.peopleSpecificCapacity = {};
                this.tasks = {};
                
                // UI state
                this.draggedElement = null;
                this.isEditingTask = false;
                this.editingTaskId = null;
                this.originalTaskData = null;
                this.currentOrderPerson = null;
                this.currentOrderDate = null;

// Initialize caches and performance tracking
this.elementCache = new Map();
this.performanceMetrics = {
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0
};

this.cachedCommonWords = null;
this.lastCommonWordsUpdate = 0;

// Initialize on page load
window.addEventListener('beforeunload', () => {
    this.cleanup();
    this.clearElementCache();
});
                
                // Configuration
                this.airtableConfig = {
                    apiKey: '',
                    baseId: '',
                    tablesConfig: {
                        people: 'People',
                        tasks: 'Tasks',
                        capacityOverrides: 'CapacityOverrides'
                    }
		};
                
                // Auto-refresh settings
                this.autoRefreshInterval = null;
                this.autoRefreshSettings = {
                    intervalSeconds: 'off',
                    isRefreshing: false
                };
                
                // Auto-capacity rule settings
                this.autoCapacityRule = {
                    enabled: false,
                    mode: 'today-tomorrow-past',
                    lastApplied: null
                };
                
                // Data loading settings
                this.dataLoadSettings = {
                    weeksBack: 2,
                    weeksForward: 4,
                    currentLoadedRange: null
                };
                
                // Constants
                this.DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                
                // Performance tracking
		this.errorCount = 0;
		this.retryQueue = [];

// State management
this.state = {
    isLoading: false,
    isOffline: !navigator.onLine,
    errorCount: 0,
    lastSync: null
};

// Configuration constants
this.config = {
    MAX_RETRIES: 3,
    DEBOUNCE_DELAY: 100,
    TOAST_DURATION: 4000,
    AUTO_SAVE_DELAY: 2000
};


                
                // Initialize
                this.init();
            }
            

            
            // User-friendly error messages
            getFriendlyErrorMessage(errorMessage) {
                if (!errorMessage) return 'An unknown error occurred';
                
                const message = errorMessage.toLowerCase();
                
                // Authentication errors
                if (message.includes('unauthorized') || message.includes('401')) {
                    return 'Your Airtable API key is invalid or expired. Please check your settings.';
                }
                
                if (message.includes('forbidden') || message.includes('403')) {
                    return 'You don\'t have permission to access this Airtable base. Check your API key and base permissions.';
                }
                
                // Not found errors
                if (message.includes('not found') || message.includes('404')) {
                    return 'The Airtable base or table was not found. Please check your Base ID and table names in settings.';
                }
                
                // Rate limiting
                if (message.includes('rate limit') || message.includes('429')) {
                    return 'Too many requests to Airtable. Please wait a moment and try again.';
                }
                
                // Network errors
                if (message.includes('network') || message.includes('fetch')) {
                    return 'Network connection failed. Please check your internet connection and try again.';
                }
                
                // Validation errors
                if (message.includes('validation') || message.includes('invalid')) {
                    return 'The data format is invalid. Please check your input and try again.';
                }
                
                // Field errors
                if (message.includes('field') && message.includes('unknown')) {
                    return 'A required field is missing in your Airtable setup. Please check your table structure.';
                }
                
                // Record limits
                if (message.includes('limit')) {
                    return 'Airtable record limit reached. Try reducing the amount of data or upgrade your plan.';
                }
                
                // Timeout errors
                if (message.includes('timeout') || message.includes('time')) {
                    return 'The request took too long. Please try again.';
                }
                
                // Generic server errors
                if (message.includes('500') || message.includes('server error')) {
                    return 'Airtable server error. Please try again in a few minutes.';
                }
                
                // If no specific match, return a cleaned version of the original error
                const cleanedMessage = errorMessage
                    .replace(/HTTP \d+/g, '')
                    .replace(/Error:/g, '')
                    .trim();
                
                // Truncate very long messages
                if (cleanedMessage.length > 100) {
                    return cleanedMessage.substring(0, 97) + '...';
                }
                
                return cleanedMessage || 'Failed to save order. Please try again.';
            }
            
            // Auto-refresh functionality
            setAutoRefreshInterval(intervalSeconds) {
                if (this.autoRefreshInterval) {
                    clearInterval(this.autoRefreshInterval);
                    this.autoRefreshInterval = null;
                }
                
                this.autoRefreshSettings.intervalSeconds = intervalSeconds;
                
                if (intervalSeconds === 'off') {
                    this.updateAutoRefreshStatus('Auto refresh is off');
                    this.saveAutoRefreshSettings();
                    return;
                }
                
                const seconds = parseInt(intervalSeconds);
                this.autoRefreshSettings.intervalSeconds = seconds;
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.autoRefreshInterval = setInterval(() => {
                        this.performAutoRefresh();
                    }, seconds * 1000);
                    
                    this.updateAutoRefreshStatus(`Auto refresh every ${this.formatInterval(seconds)}`);
                } else {
                    this.updateAutoRefreshStatus('Auto refresh disabled (not connected to Airtable)');
                }
                
                this.saveAutoRefreshSettings();
            }
            
            // Auto-capacity rule functionality
            setAutoCapacityRule(mode) {
                this.autoCapacityRule.mode = mode;
                this.autoCapacityRule.enabled = mode !== 'off';
                
                if (mode === 'off') {
                    this.updateAutoCapacityStatus('Auto-capacity rule is off');
                } else {
                    const description = mode === 'today-tomorrow' ? 
                        'Active for today + tomorrow' : 
                        'Active for today + tomorrow + past days';
                    this.updateAutoCapacityStatus(`Auto-capacity rule: ${description}`);
                    
                    this.applyAutoCapacityRule();
                }
                
                this.saveAutoCapacitySettings();
            }
            
            updateAutoCapacityStatus(message) {
                const statusDiv = document.getElementById('autoCapacityStatus');
                if (statusDiv) {
                    statusDiv.textContent = message;
                }
            }
            
            applyAutoCapacityRule() {
                if (!this.autoCapacityRule.enabled || this.autoCapacityRule.mode === 'off') {
                    return;
                }
                
                const today = new Date();
                const todayStr = this.dateToLocalDateString(today);
                
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const tomorrowStr = this.dateToLocalDateString(tomorrow);
                
                let appliedCount = 0;
                let debugLog = [];
                
                const processDate = (dateStr) => {
                    this.people.forEach(person => {
                        const personTasks = this.tasks[dateStr]?.[person] || [];
                        const usedSlots = personTasks.reduce((total, task) => total + task.duration, 0);
                        
                        if (!this.peopleSpecificCapacity[person]) {
                            this.peopleSpecificCapacity[person] = {};
                        }
                        
                        const currentCapacity = this.getPersonCapacityForDate(person, this.parseDateString(dateStr));
                        
                        // FIXED AUTO-CAPACITY LOGIC:
                        let newCapacity = null;
                        let reason = '';
                        
                        if (usedSlots > currentCapacity) {
                            // Rule 1: If used slots EXCEED capacity, DO NOT CHANGE ANYTHING
                            // This prevents auto-capacity from increasing capacity inappropriately
                            reason = `Used slots (${usedSlots}) exceed current capacity (${currentCapacity}) - no change`;
                        } else if (usedSlots === currentCapacity) {
                            // Rule 2: If used slots exactly match capacity, DO NOT CHANGE ANYTHING
                            reason = `Used slots (${usedSlots}) match current capacity (${currentCapacity}) - no change`;
                        } else if (usedSlots === 0) {
                            // Rule 3: If used slots are 0, change capacity to 0
                            newCapacity = 0;
                            reason = `No tasks scheduled - setting capacity to 0`;
                        } else {
                            // Rule 4: If used slots < capacity, change capacity to match used slots
                            newCapacity = usedSlots;
                            reason = `Reducing capacity from ${currentCapacity} to ${usedSlots} to match used slots`;
                        }
                        
                        debugLog.push({
                            person,
                            date: dateStr,
                            usedSlots,
                            currentCapacity,
                            newCapacity,
                            reason
                        });
                        
                        // Only apply the change if newCapacity is set and different from current
                        if (newCapacity !== null && newCapacity !== currentCapacity) {
                            this.peopleSpecificCapacity[person][dateStr] = newCapacity;
                            appliedCount++;
                            console.log(`✅ Auto-capacity applied: ${person} on ${dateStr} - ${reason}`);
                        } else {
                            console.log(`ℹ️ Auto-capacity skipped: ${person} on ${dateStr} - ${reason}`);
                        }
                    });
                };
                
                processDate(todayStr);
                processDate(tomorrowStr);
                
                if (this.autoCapacityRule.mode === 'today-tomorrow-past') {
                    for (let i = 1; i <= 30; i++) {
                        const pastDate = new Date(today);
                        pastDate.setDate(today.getDate() - i);
                        const pastDateStr = this.dateToLocalDateString(pastDate);
                        processDate(pastDateStr);
                    }
                }
                
                console.log('🔍 Auto-capacity rule debug log:', debugLog);
                
                if (appliedCount > 0) {
                    this.saveCapacityOverridesToLocal();
                    
                    if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                        this.syncAutoCapacityChangesToAirtable();
                    }
                    
                    this.renderWhiteboard();
                    this.updateAutoCapacityStatus(`Auto-capacity rule applied: ${appliedCount} adjustments made`);
                } else {
                    this.updateAutoCapacityStatus(`Auto-capacity rule: No adjustments needed`);
                }
                
                this.autoCapacityRule.lastApplied = new Date().toISOString();
                this.saveAutoCapacitySettings();
            }
            

            
            formatInterval(seconds) {
                if (seconds < 60) return `${seconds} seconds`;
                if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
                return `${Math.floor(seconds / 3600)} hours`;
            }
            
            updateAutoRefreshStatus(message) {
                const statusDiv = document.getElementById('autoRefreshStatus');
                if (statusDiv) {
                    statusDiv.textContent = message;
                }
            }
            
            async performAutoRefresh() {
                if (this.autoRefreshSettings.isRefreshing) {
                    return;
                }
                
                this.autoRefreshSettings.isRefreshing = true;
                
                try {
                    this.updateAutoRefreshStatus('Syncing...');
                    
                    await this.loadAllDataFromAirtable();
                    this.renderWhiteboard();
                    
                    this.autoRefreshSettings.lastRefresh = new Date();
                    
                    const lastRefreshTime = this.autoRefreshSettings.lastRefresh.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    this.updateAutoRefreshStatus(`Last synced: ${lastRefreshTime}`);
                    
                } catch (error) {
                    this.updateAutoRefreshStatus('Sync failed - will retry next cycle');
                    
                    if (error.message.includes('401') || error.message.includes('403')) {
                        this.showToast('Auto-sync authentication failed', 'error');
                        this.setAutoRefreshInterval('off');
                    }
                } finally {
                    this.autoRefreshSettings.isRefreshing = false;
                }
            }

// Due Date Offset Methods - ADD THESE TO YOUR CLASS
getDueDateOffset() {
    return parseInt(localStorage.getItem('dueDateOffset')) || 0;
}

saveDueDateOffset(days) {
    localStorage.setItem('dueDateOffset', days.toString());
}

getDefaultDueDate() {
    const offset = this.getDueDateOffset();
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + offset);
    return dueDate.toISOString().split('T')[0];
}

// Add this method for better performance monitoring
async performAsyncOperation(name, operation) {
    const startTime = performance.now();
    this.state.isLoading = true;
    
    try {
        console.log(`🚀 Starting ${name}...`);
        const result = await operation();
        
        const duration = performance.now() - startTime;
        console.log(`✅ ${name} completed in ${duration.toFixed(2)}ms`);
        
        return result;
    } catch (error) {
        const duration = performance.now() - startTime;
        console.error(`❌ ${name} failed after ${duration.toFixed(2)}ms:`, error);
        this.handleProductionError(error, name);
        throw error;
    } finally {
        this.state.isLoading = false;
    }
}
            
            async saveAutoRefreshSettings() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const settings = {
                        id: 'auto-refresh-settings',
                        intervalSeconds: this.autoRefreshSettings.intervalSeconds,
                        lastSaved: new Date().toISOString()
                    };
                    
                    return new Promise((resolve, reject) => {
                        const request = store.put(settings);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save auto-refresh settings:', error);
                }
            }
            
            async loadAutoRefreshSettings() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('auto-refresh-settings');
                        request.onsuccess = () => {
                            const result = request.result;
                            if (result && result.intervalSeconds) {
                                this.autoRefreshSettings.intervalSeconds = result.intervalSeconds;
                                const select = document.getElementById('autoRefreshSelect');
                                if (select) {
                                    select.value = result.intervalSeconds.toString();
                                }
                            }
                            resolve(result);
                        };
                        request.onerror = () => resolve(null);
                    });
                } catch (error) {
                    return null;
                }
            }
            
            async saveAutoCapacitySettings() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const settings = {
                        id: 'auto-capacity-settings',
                        mode: this.autoCapacityRule.mode,
                        enabled: this.autoCapacityRule.enabled,
                        lastApplied: this.autoCapacityRule.lastApplied,
                        lastSaved: new Date().toISOString()
                    };
                    
                    return new Promise((resolve, reject) => {
                        const request = store.put(settings);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save auto-capacity settings:', error);
                }
            }
            
            async loadAutoCapacitySettings() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('auto-capacity-settings');
                        request.onsuccess = () => {
                            const result = request.result;
                            if (result) {
                                this.autoCapacityRule.mode = result.mode || 'today-tomorrow-past';
                                this.autoCapacityRule.enabled = result.enabled !== undefined ? result.enabled : (result.mode !== 'off');
                                this.autoCapacityRule.lastApplied = result.lastApplied;
                            } else {
                                // Default settings for new users
                                this.autoCapacityRule.mode = 'today-tomorrow-past';
                                this.autoCapacityRule.enabled = true; // Enable by default
                            }
                            
                            const select = document.getElementById('autoCapacityRuleSelect');
                            if (select) {
                                select.value = this.autoCapacityRule.enabled ? this.autoCapacityRule.mode : 'off';
                            }
                            
                            if (this.autoCapacityRule.enabled) {
                                const description = this.autoCapacityRule.mode === 'today-tomorrow' ? 
                                    'Active for today + tomorrow' : 
                                    'Active for today + tomorrow + past days';
                                this.updateAutoCapacityStatus(`Auto-capacity rule: ${description}`);
                            } else {
                                this.updateAutoCapacityStatus('Auto-capacity rule is off');
                            }
                            
                            resolve(result);
                        };
                        request.onerror = () => {
                            // Default settings if storage fails
                            this.autoCapacityRule.mode = 'today-tomorrow-past';
                            this.autoCapacityRule.enabled = true;
                            resolve(null);
                        };
                    });
                } catch (error) {
                    // Default settings if database fails
                    this.autoCapacityRule.mode = 'today-tomorrow-past';
                    this.autoCapacityRule.enabled = true;
                    return null;
                }
            }
            
            async saveDataLoadSettings() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const settings = {
                        id: 'data-load-settings',
                        weeksBack: this.dataLoadSettings.weeksBack,
                        weeksForward: this.dataLoadSettings.weeksForward,
                        lastSaved: new Date().toISOString()
                    };
                    
                    return new Promise((resolve, reject) => {
                        const request = store.put(settings);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save data load settings:', error);
                }
            }
            
            async loadDataLoadSettings() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('data-load-settings');
                        request.onsuccess = () => {
                            const result = request.result;
                            if (result) {
                                this.dataLoadSettings.weeksBack = result.weeksBack || 2;
                                this.dataLoadSettings.weeksForward = result.weeksForward || 4;
                                
                                // Update the UI selects
                                const weeksBackSelect = document.getElementById('weeksBackSelect');
                                const weeksForwardSelect = document.getElementById('weeksForwardSelect');
                                if (weeksBackSelect) weeksBackSelect.value = this.dataLoadSettings.weeksBack.toString();
                                if (weeksForwardSelect) weeksForwardSelect.value = this.dataLoadSettings.weeksForward.toString();
                            }
                            this.updateDataLoadingStatus();
                            resolve(result);
                        };
                        request.onerror = () => {
                            this.updateDataLoadingStatus();
                            resolve(null);
                        };
                    });
                } catch (error) {
                    this.updateDataLoadingStatus();
                    return null;
                }
            }
            
            updateDataLoadingStatus() {
                const statusDiv = document.getElementById('dataLoadingStatus');
                if (statusDiv) {
                    const totalWeeks = this.dataLoadSettings.weeksBack + this.dataLoadSettings.weeksForward;
                    statusDiv.textContent = `Loading ${this.dataLoadSettings.weeksBack} weeks back + ${this.dataLoadSettings.weeksForward} weeks forward = ${totalWeeks} weeks total`;
                }
                
                // Update current range display
                this.updateCurrentDataRangeDisplay();
            }

// Add these methods to your TaskSchedulerApp class

// Parallel task loading
async loadTasksDataParallel() {
    console.log('🚀 Starting parallel task loading...');
    
    const startDate = new Date(this.currentDate);
    startDate.setDate(this.currentDate.getDate() - (this.dataLoadSettings.weeksBack * 7));
    
    const endDate = new Date(this.currentDate);
    endDate.setDate(this.currentDate.getDate() + (this.dataLoadSettings.weeksForward * 7));
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Loading tasks from ${startDateStr} to ${endDateStr} (parallel)`);
    
    // Use existing loadTasksFromAirtable method instead of non-existent loadAllTaskPages
    await this.loadTasksFromAirtable();
    return this.tasks;
}

// Parallel capacity loading
async loadCapacityOverridesParallel() {
    console.log('🚀 Starting parallel capacity loading...');
    return await this.loadAllCapacityPages();
}

// Parallel config loading
async loadAirtableConfigParallel() {
    console.log('🚀 Starting parallel config loading...');
    return await this.loadAllConfigPages();
}

// Enhanced parallel loader with fallback
async loadAllDataParallel() {
    const performanceTracker = this.trackLoadingPerformance();
    
    try {
        this.showLoading('🚀 Loading data (parallel mode)...');
        console.log('🚀 Starting parallel data loading...');
        
        // Execute all requests in parallel
const [peopleResult, tasksResult, capacityResult] = await Promise.all([
    this.loadPeopleFromAirtable(),    // ← ADD THIS LINE
    this.loadTasksDataParallel(),
    this.loadCapacityOverridesParallel()
]);
        
        console.log('✅ All parallel requests completed');
        
        // Process the results
        this.processTasksResult(tasksResult);
        this.processCapacityResult(capacityResult);
        
        // Re-render the whiteboard
        this.renderWhiteboard();
        
        performanceTracker.end();
        
    } catch (error) {
        console.error('❌ Parallel loading failed, falling back to sequential:', error);
        await this.loadAllDataSequential(); // Fallback to your existing method
    } finally {
        this.hideLoading();
    }
}

// Performance tracking
trackLoadingPerformance() {
    const startTime = performance.now();
    return {
        end: () => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`⚡ Loading completed in ${duration.toFixed(2)}ms`);
            return duration;
        }
    };
}
            
            updateCurrentDataRangeDisplay() {
                const currentRangeDiv = document.getElementById('currentDataRange');
                const weeksRangeSpan = document.getElementById('currentWeeksRange');
                
                if (this.dataLoadSettings.currentLoadedRange) {
                    const { startDate, endDate, loadedAt } = this.dataLoadSettings.currentLoadedRange;
                    const loadedTime = new Date(loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    if (currentRangeDiv) {
                        currentRangeDiv.innerHTML = `
                            <strong>Loaded Range:</strong> ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}<br>
                            <span class="text-xs">Last loaded: ${loadedTime}</span>
                        `;
                    }
                } else {
                    if (currentRangeDiv) {
                        currentRangeDiv.textContent = 'No data loaded yet';
                    }
                }
                
                if (weeksRangeSpan) {
                    weeksRangeSpan.textContent = `${this.dataLoadSettings.weeksBack} weeks back + ${this.dataLoadSettings.weeksForward} weeks forward`;
                }
            }
            
            async loadMoreHistoricalData() {
                if (!this.airtableConfig.apiKey || !this.airtableConfig.baseId) {
                    this.showErrorToast('validation', 'Please connect to Airtable first');
                    return;
                }
                
                // Temporarily expand the date range to load more data
                const originalWeeksBack = this.dataLoadSettings.weeksBack;
                const originalWeeksForward = this.dataLoadSettings.weeksForward;
                
                // Expand to load all historical data (up to 52 weeks back)
                this.dataLoadSettings.weeksBack = 52;
                // Keep forward range the same
                
                this.showLoading('Loading additional historical data...');
                
                try {
                    //await this.loadTasksFromAirtable();
await this.loadAllDataParallel();                    
this.renderWhiteboard();
                    
                    const totalTasks = Object.values(this.tasks).reduce((total, dateData) => {
                        return total + Object.values(dateData).reduce((dayTotal, personTasks) => {
                            return dayTotal + personTasks.length;
                        }, 0);
                    }, 0);
                    
                    this.showToast(`✅ Loaded additional historical data (${totalTasks} total orders)`, 'success');
                    
                } catch (error) {
                    this.showToast(`❌ Failed to load historical data: ${error.message}`, 'error');
                } finally {
                    // Restore original settings (but keep the expanded data loaded)
                    this.dataLoadSettings.weeksBack = originalWeeksBack;
                    this.dataLoadSettings.weeksForward = originalWeeksForward;
                    this.hideLoading();
                    this.updateDataLoadingStatus();
                }
            }
            
            async syncAutoCapacityChangesToAirtable() {
                if (!this.airtableConfig.apiKey || !this.airtableConfig.baseId) {
                    return;
                }
                
                // Prevent multiple simultaneous sync operations
                if (this.isSyncingAutoCapacity) {
                    console.log('🔄 Auto-capacity sync already in progress, skipping...');
                    return;
                }
                
                this.isSyncingAutoCapacity = true;
                
                try {
                    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.capacityOverrides || 'CapacityOverrides');
                    console.log('🔄 Starting auto-capacity sync to Airtable...');
                    
                    // Get ALL current records with proper pagination
                    let allRecords = [];
                    let offset = null;
                    
                    do {
                        const url = offset ? `${tableName}?offset=${offset}` : tableName;
                        const response = await this.makeAirtableRequest(url);
                        allRecords = allRecords.concat(response.records);
                        offset = response.offset;
                        console.log(`📄 Loaded ${response.records.length} records (total: ${allRecords.length})`);
                    } while (offset);
                    
                    console.log(`📊 Total existing capacity override records: ${allRecords.length}`);
                    
                    // Create a map for fast lookup of existing records
                    const existingRecordsMap = new Map();
                    allRecords.forEach(record => {
                        const key = `${record.fields.Person}|${record.fields.Date}`;
                        existingRecordsMap.set(key, record);
                    });
                    
                    // Track changes for logging
                    let updatedCount = 0;
                    let createdCount = 0;
                    let skippedCount = 0;
                    
                    // Process all people and their specific capacities
                    for (const person in this.peopleSpecificCapacity) {
                        const personCapacities = this.peopleSpecificCapacity[person];
                        
                        for (const date in personCapacities) {
                            const capacity = personCapacities[date];
                            const recordKey = `${person}|${date}`;
                            const existingRecord = existingRecordsMap.get(recordKey);
                            
                            if (existingRecord) {
                                // Update existing record if capacity is different
                                if (existingRecord.fields.Capacity !== capacity) {
                                    console.log(`🔄 Updating capacity override: ${person} on ${date} from ${existingRecord.fields.Capacity} to ${capacity}`);
                                    const updateData = {
                                        records: [{
                                            id: existingRecord.id,
                                            fields: {
                                                Person: person,
                                                Date: date,
                                                Capacity: capacity
                                            }
                                        }]
                                    };
                                    await this.makeAirtableRequest(tableName, 'PATCH', updateData);
                                    updatedCount++;
                                } else {
                                    console.log(`✅ Capacity override already correct: ${person} on ${date} = ${capacity}`);
                                    skippedCount++;
                                }
                            } else {
                                // Create new record only if it doesn't exist
                                console.log(`➕ Creating new capacity override: ${person} on ${date} = ${capacity}`);
                                const createData = {
                                    records: [{
                                        fields: {
                                            Person: person,
                                            Date: date,
                                            Capacity: capacity
                                        }
                                    }]
                                };
                                await this.makeAirtableRequest(tableName, 'POST', createData);
                                createdCount++;
                            }
                            
                            // Small delay to avoid rate limiting
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    }
                    
                    console.log(`✅ Auto-capacity sync completed:`, {
                        created: createdCount,
                        updated: updatedCount,
                        skipped: skippedCount,
                        total: createdCount + updatedCount + skippedCount
                    });
                    
                } catch (error) {
                    console.error('❌ Auto-capacity sync failed:', error);
                    // Don't show error to user since auto-capacity is a background operation
                } finally {
                    this.isSyncingAutoCapacity = false;
                }
            }
            
init() {
    this.updateDateDisplay();
    this.renderWhiteboard();
    this.attachEventListeners();
    this.initActivityBasedRefresh();
    this.checkForAutoLoad();
    
    // Initialize production features
    this.initOfflineDetection();
    
    console.log('🚀 Alterations Pro initialized');
}
            
            // Timezone and Date Utility Functions
            getConfiguredTimezone() {
                const timezoneSelect = document.getElementById('timezoneSelect');
                if (timezoneSelect && timezoneSelect.value !== 'local') {
                    return timezoneSelect.value;
                }
                return Intl.DateTimeFormat().resolvedOptions().timeZone;
            }
            
            createDateInTimezone(year, month, day) {
                try {
                    // Create date at noon to avoid timezone edge cases
                    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
                    return date;
                } catch (error) {
                    return new Date(year, month - 1, day, 12, 0, 0, 0);
                }
            }
            
            parseDateString(dateString) {
                if (!dateString) return null;
                
                if (dateString instanceof Date) {
                    return dateString;
                }
                
                if (typeof dateString === 'string') {
                    // Handle both YYYY-MM-DD and YYYY-MM-DDTHH:MM:SS formats
                    const dateOnly = dateString.includes('T') ? dateString.split('T')[0] : dateString;
                    const parts = dateOnly.split('-');
                    
                    if (parts.length === 3) {
                        const year = parseInt(parts[0]);
                        const month = parseInt(parts[1]);
                        const day = parseInt(parts[2]);
                        
                        if (year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                            return this.createDateInTimezone(year, month, day);
                        }
                    }
                }
                
                return null;
            }
            
            dateToLocalDateString(date) {
                if (!date) return '';
                
                try {
                    const timezone = this.getConfiguredTimezone();
                    
                    const formatter = new Intl.DateTimeFormat('en-CA', {
                        timeZone: timezone,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                    
                    return formatter.format(date);
                } catch (error) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
            
            formatDateForDisplay(dateInput) {
                const date = this.parseDateString(dateInput);
                if (!date) return 'Invalid Date';
                
                try {
                    const timezone = this.getConfiguredTimezone();
                    return new Intl.DateTimeFormat('en-US', {
                        timeZone: timezone,
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }).format(date);
                } catch (error) {
                    return date.toLocaleDateString();
                }
            }
            
updateWorkDateDisplay(dateStr) {
    if (!dateStr) return;
    
    const date = this.parseDateString(dateStr);
    if (!date) return;
    
    const dayName = this.DAYS_OF_WEEK[date.getDay()].substring(0, 3); // Get first 3 letters
    const workDateInput = document.getElementById('workDateInput');
    
    // Create or update day display
    let dayDisplay = document.getElementById('workDateDay');
    if (!dayDisplay) {
        dayDisplay = document.createElement('span');
        dayDisplay.id = 'workDateDay';
        dayDisplay.className = 'ml-2 text-sm text-gray-600 font-medium';
        workDateInput.parentNode.appendChild(dayDisplay);
    }
    
    dayDisplay.textContent = dayName;
}

            showToast(message, type = 'info') {
                const container = document.getElementById('toastContainer');
                const toast = document.createElement('div');
                const typeColors = {
                    success: 'bg-green-500',
                    error: 'bg-red-500',
                    warning: 'bg-yellow-500',
                    info: 'bg-blue-500'
                };
                
                toast.className = `${typeColors[type]} text-white px-6 py-3 rounded-lg shadow-lg fade-in max-w-sm`;
                toast.textContent = message;
                
                container.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => container.removeChild(toast), 300);
                }, 4000);
            }
            
            showLoading(message = 'Loading...') {
                this.state.isLoading = true;
                document.getElementById('loadingText').textContent = message;
                document.getElementById('loadingOverlay').classList.remove('hidden');
            }
            
            hideLoading() {
                this.state.isLoading = false;
                document.getElementById('loadingOverlay').classList.add('hidden');
            }
            
            // Date Management
            updateDateDisplay() {
                const options = { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                };
                
                if (this.viewDays === 1) {
                    document.getElementById('currentDate').textContent = this.currentDate.toLocaleDateString('en-US', options);
                } else {
                    const endDate = new Date(this.currentDate);
                    endDate.setDate(endDate.getDate() + this.viewDays - 1);
                    
                    const startStr = this.currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const yearStr = this.currentDate.getFullYear();
                    
                    document.getElementById('currentDate').textContent = `${startStr} - ${endStr}, ${yearStr}`;
                }
            }

// Due Date Offset Functions
saveDueDateOffset(days) {
    localStorage.setItem('dueDateOffset', days.toString());
    console.log(`💾 Due date offset saved: ${days} days`);
}

getDueDateOffset() {
    const saved = localStorage.getItem('dueDateOffset');
    return saved ? parseInt(saved) : 0;
}

getDefaultDueDate() {
    const offset = this.getDueDateOffset();
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + offset);
    return this.dateToLocalDateString(dueDate);
}

async saveDueDateOffsetSettings() {
    try {
        const db = await this.openConfigDatabase();
        const transaction = db.transaction(['config'], 'readwrite');
        const store = transaction.objectStore('config');
        
        const settings = {
            id: 'due-date-offset-settings',
            offsetDays: this.getDueDateOffset(),
            lastSaved: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(settings);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('Could not save due date offset settings:', error);
    }
}

async loadDueDateOffsetSettings() {
    try {
        const db = await this.openConfigDatabase();
        const transaction = db.transaction(['config'], 'readonly');
        const store = transaction.objectStore('config');
        
        return new Promise((resolve) => {
            const request = store.get('due-date-offset-settings');
            request.onsuccess = () => {
                const result = request.result;
                if (result && result.offsetDays !== undefined) {
                    localStorage.setItem('dueDateOffset', result.offsetDays.toString());
                    const settingInput = document.getElementById('dueDateOffsetSetting');
                    if (settingInput) {
                        settingInput.value = result.offsetDays;
                    }
                }
                resolve(result);
            };
            request.onerror = () => resolve(null);
        });
    } catch (error) {
        return null;
    }
}
            
// Whiteboard Rendering
renderWhiteboard() {
    console.log('🎨 renderWhiteboard() started');
    console.log('👥 this.people:', this.people);
    console.log('📏 this.people.length:', this.people ? this.people.length : 'undefined');
    console.log('🗓️ this.viewDays:', this.viewDays);
    console.log('📅 this.currentDate:', this.currentDate);
    console.log('📊 this.tasks keys:', Object.keys(this.tasks));
    
    const whiteboard = document.getElementById('whiteboard');
    const emptyState = document.getElementById('emptyState');
    
    console.log('📦 Whiteboard element found:', !!whiteboard);
    console.log('📝 EmptyState element found:', !!emptyState);
    
    if (!this.people || this.people.length === 0) {
        console.log('❌ EARLY RETURN: people array is empty or undefined');
        console.log('❌ this.people:', this.people);
        whiteboard.innerHTML = '';
        if (emptyState) {
            whiteboard.appendChild(emptyState);
        }
        return;
    }
    
    console.log('✅ Proceeding with rendering...');
    
    // Rest of your existing code...
    whiteboard.innerHTML = '';
    if (emptyState && emptyState.parentNode) {
        emptyState.style.display = 'none';
    }
    
    for (let dayOffset = 0; dayOffset < this.viewDays; dayOffset++) {
        const viewDate = new Date(this.currentDate);
        viewDate.setDate(viewDate.getDate() + dayOffset);
        
        const dayContainer = this.createDayContainer(viewDate, dayOffset);
        whiteboard.appendChild(dayContainer);
    }
    
    console.log('✅ renderWhiteboard() completed');
}
            
            createDayContainer(date, dayOffset) {
                const container = document.createElement('div');
                container.className = 'flex-shrink-0';
                
                if (this.viewDays > 1) {
                    const dayHeader = document.createElement('div');
                    dayHeader.className = 'text-center p-2 bg-gray-100 rounded-t-lg mb-2 font-semibold';
                    const dayName = this.DAYS_OF_WEEK[date.getDay()];
                    const dayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    dayHeader.textContent = `${dayName} ${dayStr}`;
                    container.appendChild(dayHeader);
                }

                const columnsContainer = document.createElement('div');
                columnsContainer.className = 'flex space-x-4';
                
                this.people.forEach(person => {
                    const column = this.createPersonColumn(person, date, dayOffset);
                    columnsContainer.appendChild(column);
                });
                
                container.appendChild(columnsContainer);
                return container;
            }
            
            createPersonColumn(person, date, dayOffset) {
                const column = document.createElement('div');
                column.className = 'flex-shrink-0 person-column w-[268px] bg-gray-50 rounded-lg border border-gray-200';
                column.dataset.person = person;
                
                const timeSlots = [];
                for (let i = 0; i < 32; i++) {
                    timeSlots.push(`<div class="time-slot relative border-gray-200"></div>`);
                }

                const capacity = this.getPersonCapacityForDate(person, date); // ✅ Use date object
                const capacityHours = Math.floor(capacity * 15 / 60);
                const capacityMins = (capacity * 15) % 60;
                const dayName = this.DAYS_OF_WEEK[date.getDay()];
                
                const dateKey = this.dateToLocalDateString(date);
const personTasks = this.tasks[dateKey]?.[person] || [];
const usedSlots = personTasks.reduce((total, task) => total + task.duration, 0);
const remainingSlots = capacity - usedSlots;  // ✅ CHANGED TO THIS
const remainingHours = Math.floor(remainingSlots * 15 / 60);
const remainingMins = (remainingSlots * 15) % 60;

                column.innerHTML = `
                    <div class="p-4 border-b border-gray-200">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="font-semibold text-lg">${person}</h3>
                            <div class="flex space-x-1">
                                <button class="add-task-btn p-1 hover:bg-gray-200 rounded transition-colors" title="Add Order" data-person="${person}" data-date="${this.dateToLocalDateString(date)}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                    </svg>
                                </button>

                                <button class="quick-capacity-header-btn p-1 hover:bg-purple-100 rounded text-purple-500 transition-colors" title="Quick Capacity Override" data-person="${person}" data-date="${this.dateToLocalDateString(date)}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                </button>
                                <button class="snap-cards-btn p-1 hover:bg-green-100 rounded text-green-500 transition-colors" title="Snap Cards to Top" data-person="${person}" data-date="${this.dateToLocalDateString(date)}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="text-xs text-gray-500 mb-1">
                            <button class="quick-capacity-btn hover:bg-gray-200 px-2 py-1 rounded transition-colors text-left w-full" 
                                    title="Click to set capacity for this day" 
                                    data-person="${person}" 
                                    data-date="${this.dateToLocalDateString(date)}">
                                ${dayName}: ${capacity} slots (${capacityHours}h ${capacityMins}m)
                            </button>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <div class="text-gray-600">
                                Used: ${usedSlots}/${capacity} slots
                            </div>
                            <div class="font-medium ${remainingSlots > 0 ? 'text-green-600' : remainingSlots === 0 ? 'text-orange-500' : 'text-red-500'}">
                                ${remainingSlots > 0 ? `${remainingSlots} remaining` : remainingSlots === 0 ? 'Full' : 'Over capacity'}
                            </div>
                        </div>
                        ${remainingSlots > 0 ? `
                        <div class="text-xs text-gray-500 mt-1">
                            (${remainingHours}h ${remainingMins}m available)
                        </div>` : ''}
                    </div>
                    <div class="task-area p-2 min-h-[600px] relative" data-person="${person}" data-date="${this.dateToLocalDateString(date)}">
                        ${timeSlots.join('')}
                    </div>
                `;

                const taskArea = column.querySelector('.task-area');
                this.addCapacityIndicators(taskArea, capacity);
                
                taskArea.addEventListener('dragover', this.handleDragOver.bind(this));
                taskArea.addEventListener('drop', this.handleDrop.bind(this));
                taskArea.addEventListener('dragleave', this.handleDragLeave.bind(this));

                this.renderTasksForPerson(taskArea, person, date);

                return column;
            }
            
            addCapacityIndicators(taskArea, capacity) {
                if (capacity < 32) {
                    const overCapacityZone = document.createElement('div');
                    overCapacityZone.className = 'over-capacity-zone';
                    overCapacityZone.style.top = `${capacity * 32}px`;
                    overCapacityZone.style.height = `${(32 - capacity) * 32}px`;
                    overCapacityZone.title = `Over capacity zone - ${32 - capacity} slots`;
                    taskArea.appendChild(overCapacityZone);
                    
                    const capacityLine = document.createElement('div');
                    capacityLine.className = 'capacity-line';
                    capacityLine.style.top = `${capacity * 32}px`;
                    capacityLine.title = `Capacity limit: ${capacity} slots`;
                    taskArea.appendChild(capacityLine);
                }
            }
            
            renderTasksForPerson(container, person, date) {
                const dateKey = this.dateToLocalDateString(date);
                const personTasks = this.tasks[dateKey]?.[person] || [];

                personTasks.forEach(task => {
                    const taskCard = this.createTaskCard(task, person, date);
                    container.appendChild(taskCard);
                });
            }
            
            formatOrderNumberForCard(orderNumber) {
                if (!orderNumber) return '#';
                
                // Always show last 3 digits if order number is longer than 3 characters
                if (orderNumber.length > 3) {
                    return '#' + orderNumber.slice(-3);
                }
                return '#' + orderNumber;
            }

validateOrderNumber(orderNumber) {
    if (!orderNumber || orderNumber.trim() === '') {
        return { isValid: false, error: 'Order number is required' };
    }
    
    const trimmed = orderNumber.trim();
    
    // Allow "NEW" or "new"
    if (trimmed.toLowerCase() === 'new') {
        return { isValid: true };
    }
    
    // Check for exactly 6 digits
    if (/^\d{6}$/.test(trimmed)) {
        return { isValid: true };
    }
    
    // Check for 1 letter + 6 digits
    if (/^[A-Za-z]\d{6}$/.test(trimmed)) {
        return { isValid: true };
    }
    
    return { 
        isValid: false, 
        error: 'Order number must be "NEW" or 6 digits (123456) or 1 letter + 6 digits (A123456)' 
    };
}
normalizeOrderNumberForComparison(orderNumber) {
    if (!orderNumber) return '';
    const trimmed = orderNumber.trim().toLowerCase();
    
    // If it's "new", return as-is
    if (trimmed === 'new') return trimmed;
    
    // Extract just the numeric part (remove any leading letters)
    const numericPart = trimmed.match(/\d{6}$/);
    return numericPart ? numericPart[0] : trimmed;
}
checkForDuplicateOrderNumber(orderNumber, excludeTaskId = null) {
    const duplicates = [];
    const normalizedOrderNumber = this.normalizeOrderNumberForComparison(orderNumber);
    
    // Search through all tasks
    Object.keys(this.tasks).forEach(dateKey => {
        Object.keys(this.tasks[dateKey]).forEach(person => {
            this.tasks[dateKey][person].forEach(task => {
                // Skip the current task if editing
                if (excludeTaskId && task.id === excludeTaskId) return;
                
                const normalizedTaskOrderNumber = this.normalizeOrderNumberForComparison(task.orderNumber);
                
                if (normalizedTaskOrderNumber === normalizedOrderNumber) {
                    duplicates.push({
                        orderNumber: task.orderNumber,
                        person: person,
                        workDate: dateKey,
                        workDateDisplay: this.formatDateForDisplay(dateKey),
                        description: task.description
                    });
                }
            });
        });
    });
    
    return duplicates;
}

			showDuplicateOrderConfirmation(duplicates, onConfirm) {
    const duplicatesList = duplicates.map(dup => 
        `• ${dup.person} on ${dup.workDateDisplay} - "${dup.description}"`
    ).join('<br>');
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="flex items-center mb-4">
                <svg class="w-6 h-6 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <h3 class="text-lg font-semibold text-gray-800">⚠️ Duplicate Order Number</h3>
            </div>
            <div class="text-gray-700 mb-4">
                <p class="mb-3">This order number already exists:</p>
                <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                    ${duplicatesList}
                </div>
            </div>
            <p class="text-sm text-gray-600 mb-6">Are you sure you want to create another order with the same number?</p>
            <div class="flex justify-end space-x-3">
                <button class="cancel-duplicate px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button class="confirm-duplicate px-4 py-2 bg-yellow-500 text-white hover:bg-yellow-600 rounded-lg transition-colors">Yes, Create Duplicate</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.cancel-duplicate').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.confirm-duplicate').addEventListener('click', () => {
        document.body.removeChild(modal);
        onConfirm();
    });
}
			
createTaskCard(task, person, date) {
    const card = document.createElement('div');
    const capacity = this.getPersonCapacityForDate(person, date);
    
    // NEW LOGIC: Distinguish between "Full" and "Over Capacity"
    const taskEnd = task.position + task.duration;
    const isExactlyAtCapacity = taskEnd === capacity && task.position < capacity;
    const isTrulyOverCapacity = task.position >= capacity || taskEnd > capacity;
    const isOverCapacity = isTrulyOverCapacity; // Keep for border logic
    
    let bgColor, borderColor;
    if (task.completed) {
        bgColor = 'bg-green-100';
        borderColor = isOverCapacity ? 'border-red-500 border-2' : 'border-green-300';
    } else {
        bgColor = 'bg-yellow-100';
        borderColor = isOverCapacity ? 'border-red-500 border-2' : 'border-yellow-300';
    }
    
    card.className = `task-card absolute left-2 right-2 ${bgColor} border rounded-lg shadow-sm cursor-move z-10 ${borderColor}`;
    card.draggable = true;
    card.dataset.taskId = task.id;
    
    const height = task.duration * 32;
    card.style.height = `${height}px`;
    card.style.top = `${task.position * 32}px`;

    let dueDateDisplay;
    let dueDateComparison;
    
    if (task.dateDue instanceof Date) {
        dueDateDisplay = task.dateDue.toLocaleDateString();
        dueDateComparison = task.dateDue;
    } else if (typeof task.dateDue === 'string') {
        const dateStr = task.dateDue.includes('T') ? task.dateDue.split('T')[0] : task.dateDue;
        const [year, month, day] = dateStr.split('-');
        const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        dueDateDisplay = localDate.toLocaleDateString();
        dueDateComparison = localDate;
    } else {
        dueDateDisplay = 'No due date';
        dueDateComparison = new Date(0);
    }
    
    const dueDateColor = dueDateComparison < new Date() ? 'text-red-500' : 'text-green-500';
    
    // NEW CAPACITY ICON LOGIC
let overCapacityIcon = '';
if (isTrulyOverCapacity) {
    overCapacityIcon = '<span class="text-red-500 ml-1" title="Over capacity">⚠</span>';
}

    const headerHeight = 40;
    const padding = 16;
    const availableHeight = height - headerHeight - padding;
    const minDescriptionHeight = 16;
    
    const showDescription = task.description && task.description.trim() && availableHeight >= minDescriptionHeight;

    card.innerHTML = `
        <div class="flex flex-col h-full px-3 pt-2 pb-3">
            <div class="flex items-center justify-between mb-2 flex-shrink-0">
                <div class="flex items-center space-x-2 flex-1 min-w-0">
                    <div class="text-sm font-semibold text-primary">${this.formatOrderNumberForCard(task.orderNumber)}</div>
                    <div class="text-sm">•</div>
                    <div class="text-sm ${dueDateColor} truncate">${dueDateDisplay}</div>
                    ${overCapacityIcon}
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <span class="flex items-center cursor-pointer" title="${task.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                        <input type="checkbox" class="complete-checkbox w-4 h-4 text-primary border border-gray-300 rounded focus:ring-2 focus:ring-primary" ${task.completed ? 'checked' : ''}>
                    </span>
                    <button class="print-tags-btn text-gray-400 hover:text-purple-500 transition-colors p-1" title="Print Tags">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 001 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                    </button>
                    <button class="delete-task-btn text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete task">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
            ${showDescription ? `
                <div class="flex-1 min-h-0">
                    <div class="text-xs text-gray-600 leading-tight overflow-hidden" 
                         style="max-height: ${Math.max(0, availableHeight)}px; 
                                display: -webkit-box; 
                                -webkit-line-clamp: ${Math.floor(availableHeight / 14)}; 
                                -webkit-box-orient: vertical;"
                         title="${task.description}">
                        ${task.description}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    this.attachTaskCardListeners(card, task);

    return card;
}
            
attachTaskCardListeners(card, task) {
                card.addEventListener('dragstart', this.handleDragStart.bind(this));
                card.addEventListener('dragend', this.handleDragEnd.bind(this));

                card.addEventListener('dblclick', (e) => {
                    if (!e.target.closest('.complete-toggle-btn')) {
                        this.showTaskDetails(task);
                    }
                });

                // Add context menu for duplicate and other actions
                card.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showTaskContextMenu(e, task);
                });

                const deleteBtn = card.querySelector('.delete-task-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.showDeleteConfirmation(task);
                });

                const moreBtn = card.querySelector('.more-btn');
                if (moreBtn) {
                    moreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.showTaskDetails(task);
                    });
                }

                const completeCheckbox = card.querySelector('.complete-checkbox');
                let isToggling = false;
                
                completeCheckbox.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    
                    if (isToggling) return;
                    isToggling = true;
                    
                    try {
                        await this.toggleTaskCompletion(task);
                    } finally {
                        setTimeout(() => {
                            isToggling = false;
                        }, 100);
                    }
                });
            }
            
            // Capacity Management
            getPersonCapacityForDate(person, date) {
                const dateKey = this.dateToLocalDateString(date);
                
                // First check for specific date overrides (this is the highest priority)
                if (this.peopleSpecificCapacity[person] && this.peopleSpecificCapacity[person][dateKey] !== undefined) {
                    const specificCapacity = this.peopleSpecificCapacity[person][dateKey];
                    return specificCapacity;
                }
                
                // Check weekly capacity (normal schedule)
                const dayOfWeek = date.getDay();
                const dayName = this.DAYS_OF_WEEK[dayOfWeek];
                
                if (this.peopleCapacity[person] && typeof this.peopleCapacity[person] === 'object') {
                    const weeklyCapacity = this.peopleCapacity[person][dayName] || 0;
                    return weeklyCapacity;
                }
                
                // Fallback to default capacity if no weekly schedule is set
                const defaultCapacity = this.peopleCapacity[person] || 16;
                return defaultCapacity;
            }

            async saveViewPreferences() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const viewPrefs = {
                        id: 'view-preferences',
                        viewDays: this.viewDays,
                        lastSaved: new Date().toISOString()
                    };
                    
                    return new Promise((resolve, reject) => {
                        const request = store.put(viewPrefs);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save view preferences:', error);
                }
            }
            
            async loadViewPreferences() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('view-preferences');
                        request.onsuccess = () => {
                            const result = request.result;
                            if (result && result.viewDays) {
                                this.viewDays = result.viewDays;
                                const viewSelect = document.getElementById('viewDaysSelect');
                                if (viewSelect) {
                                    viewSelect.value = result.viewDays.toString();
                                }
                            }
                            resolve(result);
                        };
                        request.onerror = () => resolve(null);
                    });
                } catch (error) {
                    return null;
                }
            }
            
            // Event Listeners
            attachEventListeners() {
                // Date navigation
                document.getElementById('prevDay').addEventListener('click', (e) => {
                    e.preventDefault();
                    const newDate = new Date(this.currentDate);
                    newDate.setDate(newDate.getDate() - 1);
                    this.currentDate = newDate;
                    this.updateDateDisplay();
                    this.renderWhiteboard();
                    this.showToast('Previous day: ' + this.currentDate.toLocaleDateString(), 'info');
                });

                document.getElementById('nextDay').addEventListener('click', (e) => {
                    e.preventDefault();
                    const newDate = new Date(this.currentDate);
                    newDate.setDate(newDate.getDate() + 1);
                    this.currentDate = newDate;
                    this.updateDateDisplay();
                    this.renderWhiteboard();
                    this.showToast('Next day: ' + this.currentDate.toLocaleDateString(), 'info');
                });

                document.getElementById('todayBtn').addEventListener('click', (e) => {
                    e.preventDefault();
                    this.currentDate = new Date();
                    this.updateDateDisplay();
                    this.renderWhiteboard();
                    this.showToast('Today: ' + this.currentDate.toLocaleDateString(), 'info');
                });

                document.getElementById('currentDate').addEventListener('click', () => {
                    this.showDatePicker();
                });

                document.getElementById('viewDaysSelect').addEventListener('change', async (e) => {
                    this.viewDays = parseInt(e.target.value);
                    this.updateDateDisplay();
                    this.renderWhiteboard();
                    await this.saveViewPreferences();
                });

                // Main action buttons
                document.getElementById('addNewOrderBtn').addEventListener('click', () => this.showNewOrderModal());
                document.getElementById('searchBtn').addEventListener('click', () => this.showSearchModal());
                document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
                document.getElementById('readyDateBtn').addEventListener('click', () => this.showReportsModal());
                document.getElementById('shareBtn').addEventListener('click', () => this.showShareModal());
                document.getElementById('setupBtn').addEventListener('click', () => this.showSettingsModal());

                this.attachModalCloseListeners();
                this.attachSettingsListeners();
                this.attachSearchListeners();
                this.attachReportsListeners();
                this.attachOrderModalListeners();
                this.attachTagPrintingListeners();

                // Dynamic event delegation
                document.addEventListener('click', (e) => {
                    if (e.target.closest('.add-task-btn')) {
                        const btn = e.target.closest('.add-task-btn');
                        const person = btn.dataset.person;
                        const date = btn.dataset.date;
                        this.showOrderModalForPerson(person, date);
                    } else if (e.target.closest('.edit-capacity-btn')) {
                        const person = e.target.closest('.edit-capacity-btn').dataset.person;
                        this.showCapacityModal(person);
                    } else if (e.target.closest('.remove-person-btn')) {
                        const person = e.target.closest('.remove-person-btn').dataset.person;
                        this.showRemovePersonConfirmation(person);
                    } else if (e.target.closest('.snap-cards-btn')) {
                        const btn = e.target.closest('.snap-cards-btn');
                        const person = btn.dataset.person;
                        const dateKey = btn.dataset.date;
                        this.snapCardsToTop(person, dateKey);
                    } else if (e.target.closest('.quick-capacity-btn')) {
                        const btn = e.target.closest('.quick-capacity-btn');
                        const person = btn.dataset.person;
                        const date = btn.dataset.date;
                        this.showQuickCapacityModal(person, date);
                    } else if (e.target.closest('.quick-capacity-header-btn')) {
                        const btn = e.target.closest('.quick-capacity-header-btn');
                        const person = btn.dataset.person;
                        const date = btn.dataset.date;
                        this.showQuickCapacityModal(person, date);
                    } else if (e.target.closest('.print-tags-btn')) {
                        console.log('Print tags button clicked');
                        const btn = e.target.closest('.print-tags-btn');
                        const taskCard = btn.closest('.task-card');
                        console.log('Found task card:', taskCard);
                        if (taskCard) {
                            const taskId = taskCard.dataset.taskId;
                            console.log('Task ID:', taskId);
                            this.showTagPrintingModal(taskId);
                        }
                    }
                });

                // Enhanced keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    // Skip if user is typing in an input
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                        return;
                    }
                    
                    // Skip if a modal is open
                    const modals = document.querySelectorAll('.fixed.inset-0:not(.hidden)');
                    if (modals.length > 0) {
                        // Allow some shortcuts in modals
                        if (e.key === 'Escape') {
                            const topModal = modals[modals.length - 1];
                            const closeBtn = topModal.querySelector('[id*="close"], .cancel-btn, .close-');
                            if (closeBtn) closeBtn.click();
                        }
                        return;
                    }
                    
                    const ctrl = e.ctrlKey || e.metaKey;
                    const shift = e.shiftKey;
                    
                    switch (e.key.toLowerCase()) {
                        case 'f':
                            if (ctrl) {
                                e.preventDefault();
                                this.showSearchModal();
                            }
                            break;
                        case 'n':
                            if (ctrl) {
                                e.preventDefault();
                                this.showNewOrderModal();
                            }
                            break;
                        case 'r':
                            if (ctrl) {
                                e.preventDefault();
                                this.showReportsModal();
                            }
                            break;
                        case 's':
                            if (ctrl && shift) {
                                e.preventDefault();
                                this.showSettingsModal();
                            }
                            break;
                        case 't':
                            if (!ctrl) {
                                e.preventDefault();
                                this.goToToday();
                            }
                            break;
                        case 'arrowleft':
                            if (!ctrl) {
                                e.preventDefault();
                                this.navigateDay(-1);
                            }
                            break;
                        case 'arrowright':
                            if (!ctrl) {
                                e.preventDefault();
                                this.navigateDay(1);
                            }
                            break;
                        case '1':
                        case '2':
                        case '3':
                            if (!ctrl) {
                                e.preventDefault();
                                this.setViewDays(parseInt(e.key));
                            }
                            break;
                        case '?':
                        case 'h':
                            if (!ctrl) {
                                e.preventDefault();
                                this.showKeyboardShortcuts();
                            }
                            break;
                        case 'escape':
                            // Close any open context menus
                            this.removeContextMenu();
                            break;
                    }
                });
                
                this.showKeyboardShortcutsToast();
            }
            
            attachModalCloseListeners() {
                const closeButtons = [
                    'closeOrderModal',
                    'closeSettingsModal', 
                    'closeSearchModal',
                    'closeReportsModal',
                    'closeShareModal'
                ];
                
                closeButtons.forEach(id => {
                    document.getElementById(id)?.addEventListener('click', () => {
                        document.getElementById(id.replace('close', '').replace('Modal', '').toLowerCase() + 'Modal').classList.add('hidden');
                    });
                });

                document.getElementById('cancelOrder')?.addEventListener('click', () => {
                    this.getElement('orderModal').classList.add('hidden');
                    this.resetOrderModal();
                });

                document.getElementById('cancelSettings')?.addEventListener('click', () => {
                    this.handleModalAction('settingsModal', 'hide');
                });
            }
            
            attachSettingsListeners() {
                document.getElementById('databaseTab').addEventListener('click', () => this.switchSettingsTab('database'));
                document.getElementById('peopleTab').addEventListener('click', () => this.switchSettingsTab('people'));
                document.getElementById('editTextTab').addEventListener('click', () => this.switchSettingsTab('editText'));

                document.getElementById('saveEditText').addEventListener('click', () => this.saveEditText());
                document.getElementById('clearEditText').addEventListener('click', () => this.clearEditText());

                document.getElementById('testConnection').addEventListener('click', () => this.testAirtableConnection());
                document.getElementById('saveSettings').addEventListener('click', () => this.saveSettingsAndConnect());
                document.getElementById('downloadConfig').addEventListener('click', () => this.downloadConfig());
                document.getElementById('uploadConfig').addEventListener('change', (e) => this.uploadConfig(e));

                document.getElementById('autoRefreshSelect').addEventListener('change', (e) => this.setAutoRefreshInterval(e.target.value));
                document.getElementById('applyAutoCapacityBtn').addEventListener('click', () => {
                    const selectedMode = document.getElementById('autoCapacityRuleSelect').value;
                    this.setAutoCapacityRule(selectedMode);
                });

                // Data loading settings
                document.getElementById('weeksBackSelect').addEventListener('change', (e) => {
                    this.dataLoadSettings.weeksBack = parseInt(e.target.value);
                    this.saveDataLoadSettings();
                    this.updateDataLoadingStatus();
                });
                document.getElementById('weeksForwardSelect').addEventListener('change', (e) => {
                    this.dataLoadSettings.weeksForward = parseInt(e.target.value);
                    this.saveDataLoadSettings();
                    this.updateDataLoadingStatus();
                });

                // Load More Historical Data button
                document.getElementById('loadMoreDataBtn').addEventListener('click', () => {
                    this.loadMoreHistoricalData();
                });

                document.getElementById('addPersonBtn').addEventListener('click', () => this.addPerson());
                document.getElementById('clearPersonForm').addEventListener('click', () => this.clearPersonForm());

                document.getElementById('presetFullTime').addEventListener('click', () => this.applyCapacityPreset({
                    Monday: 16, Tuesday: 16, Wednesday: 16, Thursday: 16, Friday: 16, Saturday: 0, Sunday: 0
                }));
                document.getElementById('presetPartTime').addEventListener('click', () => this.applyCapacityPreset({
                    Monday: 8, Tuesday: 8, Wednesday: 8, Thursday: 8, Friday: 8, Saturday: 0, Sunday: 0
                }));
                document.getElementById('presetWeekends').addEventListener('click', () => this.applyCapacityPreset({
                    Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 16, Saturday: 16
                }));
                document.getElementById('presetClear').addEventListener('click', () => this.applyCapacityPreset({
                    Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
                }));

                this.setupPersonCapacityInputs();
            }
            
            attachSearchListeners() {
                const searchInput = document.getElementById('searchInput');
                const performSearch = document.getElementById('performSearch');

                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.performSearch();
                    }
                });

                performSearch.addEventListener('click', () => this.performSearch());

                document.getElementById('searchToday').addEventListener('click', () => this.setSearchDateRange('today'));
                document.getElementById('searchThisWeek').addEventListener('click', () => this.setSearchDateRange('week'));
                document.getElementById('searchAllTime').addEventListener('click', () => this.setSearchDateRange('all'));
                document.getElementById('clearSearchFilters').addEventListener('click', () => this.clearSearchFilters());
            }
            
            attachReportsListeners() {
                document.getElementById('reportToday').addEventListener('click', () => this.setReportDateRange('today'));
                document.getElementById('reportTomorrow').addEventListener('click', () => this.setReportDateRange('tomorrow'));
                document.getElementById('reportWeek').addEventListener('click', () => this.setReportDateRange('week'));
                document.getElementById('reportMonth').addEventListener('click', () => this.setReportDateRange('month'));

                document.getElementById('generateAllReport').addEventListener('click', () => this.generateReport('all'));
                document.getElementById('generateIncompleteReport').addEventListener('click', () => this.generateReport('incomplete'));
                document.getElementById('generateCompletedReport').addEventListener('click', () => this.generateReport('completed'));

                document.getElementById('exportReport').addEventListener('click', () => this.showExportOptionsModal());
            }
            
            attachTagPrintingListeners() {
                // Close tag printing modal
                document.getElementById('closeTagPrintingModal').addEventListener('click', () => {
                    this.handleModalAction('tagPrintingModal', 'hide');
                });
                
                document.getElementById('cancelTagPrinting').addEventListener('click', () => {
                    this.handleModalAction('tagPrintingModal', 'hide');
                });
                
                // Update tag quantity
                document.getElementById('updateTagQuantity').addEventListener('click', () => {
                    const newQuantity = parseInt(document.getElementById('tagQuantityInput').value) || 1;
                    this.updateTagTable(newQuantity);
                    this.updateTagPreview();
                });
                
                // Bulk actions
                document.getElementById('applyBulkInfo').addEventListener('click', () => {
                    const bulkInfo = document.getElementById('bulkCustomInfo').value;
                    this.applyBulkCustomInfo(bulkInfo);
                });
                
                document.getElementById('clearAllInfo').addEventListener('click', () => {
                    this.clearAllCustomInfo();
                });
                
                // Template buttons
                document.addEventListener('click', (e) => {
                    if (e.target.closest('.template-btn')) {
                        const template = e.target.closest('.template-btn').dataset.template;
                        document.getElementById('bulkCustomInfo').value = template;
                    }
                });
                
                // Print tags
                document.getElementById('printTags').addEventListener('click', () => {
                    this.printAllTags();
                });
                
                // Tag quantity quick buttons  
                document.addEventListener('click', (e) => {
                    if (e.target.closest('.tags-qty-btn')) {
                        const btn = e.target.closest('.tags-qty-btn');
                        const quantity = btn.dataset.quantity;
                        const input = document.getElementById('tagsQuantityInput');
                        if (input) {
                            input.value = quantity;
                        }
                    }
                });
            }
            
            // Tag Printing Functionality
            showTagPrintingModal(taskId) {
                console.log('showTagPrintingModal called with taskId:', taskId);
                
                // Find the task data
                let foundTask = null;
                let taskPerson = null;
                let taskDate = null;
                
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const task = this.tasks[dateKey][person].find(t => t.id == taskId);
                        if (task) {
                            foundTask = task;
                            taskPerson = person;
                            taskDate = dateKey;
                            break;
                        }
                    }
                    if (foundTask) break;
                }
                
                console.log('Found task:', foundTask);
                
                if (!foundTask) {
                    this.showToast('Task not found', 'error');
                    return;
                }
                
                // Store current tag data for printing
                this.currentTagData = {
                    task: foundTask,
                    person: taskPerson,
                    dateKey: taskDate,
                    quantity: foundTask.tagsQuantity || 1
                };
                
                console.log('Current tag data:', this.currentTagData);
                
                // Show the modal
                this.handleModalAction('tagPrintingModal', 'show');
                
                // Initialize the tag table and preview
                document.getElementById('tagQuantityInput').value = this.currentTagData.quantity;
                this.updateTagTable(this.currentTagData.quantity);
                this.updateTagPreview();
                
                // Check for DirectPrint extension availability
                this.checkDirectPrintStatus();
            }
            
            showTagPrintingModalFromOrder(tempTaskData, person, dateKey) {
                console.log('showTagPrintingModalFromOrder called with:', tempTaskData, person, dateKey);
                
                // Store current tag data for printing from order modal
                this.currentTagData = {
                    task: tempTaskData,
                    person: person,
                    dateKey: dateKey,
                    quantity: tempTaskData.tagsQuantity || 1
                };
                
                console.log('Current tag data from order:', this.currentTagData);
                
                // Show the modal
                this.handleModalAction('tagPrintingModal', 'show');
                
                // Initialize the tag table and preview
                document.getElementById('tagQuantityInput').value = this.currentTagData.quantity;
                this.updateTagTable(this.currentTagData.quantity);
                this.updateTagPreview();
                
                // Check for DirectPrint extension availability
                this.checkDirectPrintStatus();
            }
            
            checkDirectPrintStatus() {
                // Wait for DirectPrint API to load if it's being injected
                setTimeout(() => {
                    const tagPrintingModal = document.getElementById('tagPrintingModal');
                    
                    // Only show status if modal exists and is visible
                    if (!tagPrintingModal || tagPrintingModal.classList.contains('hidden')) {
                        return;
                    }
                    
                    // Create status div if it doesn't exist
                    let statusDiv = document.getElementById('directPrintStatus');
                    if (!statusDiv) {
                        statusDiv = document.createElement('div');
                        statusDiv.id = 'directPrintStatus';
                        
                        // Insert after the close button header
                        const modal = tagPrintingModal.querySelector('.bg-white, .bg-gray-800');
                        const headerSection = modal.children[0];
                        headerSection.insertAdjacentElement('afterend', statusDiv);
                    }
                    
                    if (window.DirectPrint && window.DirectPrint.isAvailable) {
                        statusDiv.innerHTML = `
                            <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                    <span class="text-green-700 font-medium">🖨️ DirectPrint Extension Active</span>
                                </div>
                                <p class="text-sm text-green-600 mt-1">Tags will print directly to your thermal printer without browser dialogs.</p>
                            </div>
                        `;
                    } else {
                        statusDiv.innerHTML = `
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                    </svg>
                                    <span class="text-yellow-700 font-medium">⚠️ DirectPrint Extension Not Available</span>
                                </div>
                                <p class="text-sm text-yellow-600 mt-1">Install the Chrome extension for direct printing. Tags will use browser print dialog as fallback.</p>
                            </div>
                        `;
                    }
                }, 100);
            }
            
            showExtensionHelp() {
                const helpModal = this.createModal('🔧 Install DirectPrint Extension', `
                    <div class="space-y-4 text-sm">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 class="font-semibold text-blue-800 mb-3">📋 Installation Steps</h4>
                            <ol class="list-decimal list-inside space-y-2 text-blue-700">
                                <li>Load the extension files into Chrome Developer Mode</li>
                                <li>Open Chrome and go to <code class="bg-blue-100 px-1 rounded">chrome://extensions/</code></li>
                                <li>Enable "Developer mode" in the top-right corner</li>
                                <li>Click "Load unpacked" and select the extension folder</li>
                                <li>The DirectPrint extension should now appear in your extensions list</li>
                            </ol>
                        </div>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 class="font-semibold text-yellow-800 mb-2">⚡ Extension Features</h4>
                            <ul class="list-disc list-inside space-y-1 text-yellow-700">
                                <li>Direct printing to thermal/label printers</li>
                                <li>Bypasses browser print dialogs</li>
                                <li>Automatic printer detection</li>
                                <li>Custom paper sizes for labels</li>
                                <li>Test printing functionality</li>
                            </ul>
                        </div>
                        
                        <div class="text-center pt-4 border-t border-gray-200">
                            <p class="text-xs text-gray-500">
                                Once installed, refresh this page and the extension will be automatically detected.
                            </p>
                        </div>
                    </div>
                `, { maxWidth: 'max-w-lg' });
            }
            
            updateTagTable(quantity) {
                if (!this.currentTagData) return;
                
                const tbody = document.getElementById('tagTableBody');
                tbody.innerHTML = '';
                
                const workDate = this.parseDateString(this.currentTagData.dateKey);
                const dayName = this.DAYS_OF_WEEK[workDate.getDay()];
                const formattedWorkDate = this.formatDateForDisplay(this.currentTagData.dateKey);
                
                for (let i = 1; i <= quantity; i++) {
                    const row = document.createElement('tr');
                    row.className = 'bg-white';
                    row.innerHTML = `
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${i}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${this.currentTagData.task.orderNumber}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${this.currentTagData.person}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${dayName}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${formattedWorkDate}</td>
                        <td class="px-4 py-3">
                            <input type="text" class="tag-custom-info w-full p-2 text-sm border border-gray-300 rounded bg-white" 
                                   placeholder="Custom info..." data-tag-index="${i}">
                        </td>
                    `;
                    tbody.appendChild(row);
                }
                
                // Update total count
                document.getElementById('totalTagsCount').textContent = quantity;
                
                // Add event listeners to custom info inputs
                const customInfoInputs = tbody.querySelectorAll('.tag-custom-info');
                customInfoInputs.forEach(input => {
                    input.addEventListener('input', () => {
                        this.updateTagPreview();
                    });
                });
            }
            
            updateTagPreview() {
                if (!this.currentTagData) return;
                
                const previewContainer = document.getElementById('tagPrintPreview');
                previewContainer.innerHTML = '';
                
                const tagInputs = document.querySelectorAll('.tag-custom-info');
                
                tagInputs.forEach((input, index) => {
                    const tagNumber = index + 1;
                    const customInfo = input.value.trim() || '';
                    
                    const tagPreview = document.createElement('div');
                    tagPreview.className = 'border border-gray-300 rounded p-3 bg-white text-sm';
                    tagPreview.innerHTML = `
                        <div class="font-bold text-primary text-lg mb-2">Tag ${tagNumber} - Order #${this.currentTagData.task.orderNumber}</div>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div><strong>Person:</strong> ${this.currentTagData.person}</div>
                            <div><strong>Work Day:</strong> ${this.DAYS_OF_WEEK[this.parseDateString(this.currentTagData.dateKey).getDay()]}</div>
                            <div><strong>Work Date:</strong> ${this.formatDateForDisplay(this.currentTagData.dateKey)}</div>
                            <div><strong>Due Date:</strong> ${this.formatDateForDisplay(this.currentTagData.task.dateDue)}</div>
                        </div>
                        ${customInfo ? `<div class="mt-2 font-medium text-blue-600">${customInfo}</div>` : ''}
                        <div class="mt-2 text-xs text-gray-500">${this.currentTagData.task.description}</div><div></div><div></div>
                    `;
                    previewContainer.appendChild(tagPreview);
                });
            }
            
            applyBulkCustomInfo(info) {
                const tagInputs = document.querySelectorAll('.tag-custom-info');
                tagInputs.forEach(input => {
                    input.value = info;
                });
                this.updateTagPreview();
            }
            
            clearAllCustomInfo() {
                const tagInputs = document.querySelectorAll('.tag-custom-info');
                tagInputs.forEach(input => {
                    input.value = '';
                });
                this.updateTagPreview();
            }
            
async printAllTags() {
    if (!this.currentTagData) return;
    
    const tagInputs = document.querySelectorAll('.tag-custom-info');
    const printWindow = window.open('', '_blank');
    
    let content = '';
    
    for (let i = 0; i < tagInputs.length; i++) {
        const input = tagInputs[i];
        const tagNumber = i + 1;
        const customInfo = input.value || '';
        const workDate = this.parseDateString(this.currentTagData.dateKey);
        const dayName = this.DAYS_OF_WEEK[workDate.getDay()];
        
        // Thermal printer format - shorter lines
        content += '========================\n';
        content += '    TAG ' + tagNumber + ' - ORDER\n';
        content += '========================\n';
        content += '\n';
        content += 'Order: ' + this.currentTagData.task.orderNumber + '\n';
        content += '\n';
        content += 'Person: ' + this.currentTagData.person + '\n';
        content += '\n';
        content += 'Day: ' + dayName + '\n';
        content += '\n';
        content += 'Date: ' + this.formatDateForDisplay(this.currentTagData.dateKey) + '\n';
        
        if (customInfo && customInfo.length > 0) {
            content += '\n';
            content += 'ALTERATION:\n';
            content += customInfo + '\n';
        }
        
        content += '\n';
        content += '========================\n';
        content += '\n';
        content += '      -- CUT HERE --\n';
        content += '\n';
        content += '\n';
        content += '\n';
        content += '\n';
        content += '\n';
    }
    
    // Use simple pre tag for thermal printers
    const html = '<html><head><style>body{margin:0;padding:5px;font-family:monospace;font-size:12px;line-height:1.2;}</style></head><body><pre>' + content + '</pre></body></html>';
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    
    this.handleModalAction('tagPrintingModal', 'hide');
    this.showToast('Thermal printer tags created', 'success');
}
            
async printTagsDirectly(tagInputs) {
    // Make content VERY WIDE so it can't fit side by side
    for (let index = 0; index < tagInputs.length; index++) {
        const input = tagInputs[index];
        const tagNumber = index + 1;
        const customInfo = input.value || '';
        const workDate = this.parseDateString(this.currentTagData.dateKey);
        const dayName = this.DAYS_OF_WEEK[workDate.getDay()];
        
        const tagWindow = window.open('', `tag${tagNumber}`, 'width=600,height=400');
        
        const wideHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: monospace; 
                        font-size: 14px; 
                        margin: 0; 
                        padding: 20px;
                        width: 500px;
                    }
                    .wide-line {
                        width: 500px;
                        padding: 5px 0;
                        border: 1px solid black;
                        margin-bottom: 2px;
                        text-align: center;
                        background: white;
                    }
                </style>
            </head>
            <body>
                <div class="wide-line">============== TAG ${tagNumber} - ORDER ==============</div>
                <div class="wide-line">PERSON: ${this.currentTagData.person}</div>
                <div class="wide-line">WORK DAY: ${dayName}</div>
                <div class="wide-line">WORK DATE: ${this.formatDateForDisplay(this.currentTagData.dateKey)}</div>
                ${customInfo ? `<div class="wide-line">ALTERATION: ${customInfo}</div>` : ''}
                <div class="wide-line">===============================================</div>
            </body>
            </html>
        `;
        
        tagWindow.document.write(wideHTML);
        tagWindow.document.close();
        
        // Auto-print with delay
        setTimeout(() => {
            tagWindow.focus();
            tagWindow.print();
            setTimeout(() => tagWindow.close(), 2000);
        }, index * 3000);
    }
    
    this.handleModalAction('tagPrintingModal', 'hide');
    this.showToast(`📏 Printing ${tagInputs.length} WIDE tags to prevent side-by-side layout`, 'success');
}

 printTagsWithBrowserDialog(tagInputs) {
                // Create a print window with all tags (original browser printing method)
                const printWindow = window.open('', '_blank');
                
                let printContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Print Tags - Order #${this.currentTagData.task.orderNumber}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
.tag { 
    border: 2px solid #333; 
    padding: 12px; 
    margin-bottom: 10px; 
    page-break-inside: avoid;
    page-break-after: always;
    min-height: 80px;
    max-height: 120px;
    font-size: 14px;
    line-height: 1.4;
    background: white;
    width: calc(100% - 24px);
}
.tag-header { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
.tag-info { font-size: 16px; margin-bottom: 8px; }
.tag-custom { font-size: 16px; font-weight: bold; color: #0066cc; margin: 10px 0; }
                            .tag-description { font-size: 11px; color: #666; margin-top: 10px; }
                            @media print {
                                .tag { page-break-after: always; }
                                .tag:last-child { page-break-after: auto; }
                            }
                        </style>
                    </head>
                    <body>
                `;
                
                tagInputs.forEach((input, index) => {
                    const tagNumber = index + 1;
                    const customInfo = input.value || '';
                    const workDate = this.parseDateString(this.currentTagData.dateKey);
                    const dayName = this.DAYS_OF_WEEK[workDate.getDay()];
                    
printContent += `
    <div class="tag">
        <div class="tag-header">Tag ${tagNumber} - Order ${this.currentTagData.task.orderNumber}</div>
        <div class="tag-info"><strong>Person:</strong> ${this.currentTagData.person}</div>
        <div class="tag-info"><strong>Work Day:</strong> ${dayName.substring(0, 3)}</div>
        <div class="tag-info"><strong>Work Date:</strong> ${this.formatDateForDisplay(this.currentTagData.dateKey)}</div>
        ${customInfo ? `<div class="tag-custom"><strong>Alteration:</strong> ${customInfo}</div>` : ''}
    </div>
`;
                });
                
                printContent += `
                    </body>
                    </html>
                `;
                
                printWindow.document.open();
                printWindow.document.write(printContent);
                printWindow.document.close();
                
                // Auto-print after a short delay with dialog bypass attempt
                setTimeout(() => {
                    if (printWindow && !printWindow.closed) {
                        printWindow.focus();
                        printWindow.print();
                        
                        // Attempt to auto-confirm print dialog (limited browser support)
                        setTimeout(() => {
                            try {
                                // Try to simulate Enter key press on print dialog
                                const event = new KeyboardEvent('keydown', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true
                                });
                                printWindow.document.dispatchEvent(event);
                                document.dispatchEvent(event);
                            } catch (e) {
                                // Silently fail if not supported
                                console.log('Auto-confirm not supported in this browser');
                            }
                            
                            setTimeout(() => printWindow.close(), 1000);
                        }, 200);
                    }
                }, 800);
                
                // Close the modal
                this.handleModalAction('tagPrintingModal', 'hide');
                this.showToast(`${tagInputs.length} tags sent to printer (browser dialog)`, 'info');
            }
            
            formatDateForPrint(dateInput) {
                const date = this.parseDateString(dateInput);
                if (!date) return 'Invalid Date';
                
                try {
                    // Format as MM/DD/YYYY for thermal printer
                    return (date.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                           date.getDate().toString().padStart(2, '0') + '/' + 
                           date.getFullYear();
                } catch (error) {
                    return date.toLocaleDateString();
                }
            }
            
            normalizeDate(dateInput) {
                // Normalize any date input to YYYY-MM-DD format for consistent storage
                if (!dateInput) return '';
                
                // If it's already a string in YYYY-MM-DD format, return as-is
                if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                    return dateInput;
                }
                
                // Parse the date and convert to YYYY-MM-DD format
                const date = this.parseDateString(dateInput);
                if (!date) return '';
                
                return this.dateToLocalDateString(date);
            }
            
attachOrderModalListeners() {
    document.getElementById('saveOrder').addEventListener('click', () => this.saveOrder());

    document.getElementById('workDateInput').addEventListener('change', (e) => {
        this.updateWorkDateDisplay(e.target.value);
    });

    // Order Number Real-time Validation
    const orderNumberInput = document.getElementById('orderNumberInput');
    if (orderNumberInput) {
        // Remove existing validation elements
        const existingError = orderNumberInput.parentNode.querySelector('.validation-error');
        if (existingError) existingError.remove();
        
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error text-red-500 text-xs mt-1 hidden';
        orderNumberInput.parentNode.appendChild(errorDiv);
        
        orderNumberInput.addEventListener('input', (e) => {
            const value = e.target.value;
            const validation = this.validateOrderNumber(value);
            
            if (!validation.isValid && value.trim() !== '') {
                // Show error
                errorDiv.textContent = validation.error;
                errorDiv.classList.remove('hidden');
                e.target.classList.add('border-red-500');
                e.target.classList.remove('border-gray-300');
            } else {
                // Hide error
                errorDiv.classList.add('hidden');
                e.target.classList.remove('border-red-500');
                e.target.classList.add('border-gray-300');
            }
        });
        
        // Validate on blur (when user leaves the field)
        orderNumberInput.addEventListener('blur', (e) => {
            const value = e.target.value;
            const validation = this.validateOrderNumber(value);
            
            if (!validation.isValid) {
                errorDiv.textContent = validation.error;
                errorDiv.classList.remove('hidden');
                e.target.classList.add('border-red-500');
            }
        });
    }

    // Print Tags From Order button
    document.getElementById('printTagsFromOrder').addEventListener('click', () => {
        // Get current order data from modal
        const orderNumber = document.getElementById('orderNumberInput').value.trim();
        const tagsQuantity = parseInt(document.getElementById('tagsQuantityInput').value) || 1;
        
        // Validate order number before proceeding
        const orderValidation = this.validateOrderNumber(orderNumber);
        if (!orderValidation.isValid) {
            this.showErrorToast('validation', orderValidation.error);
            return;
        }
        
        // Create a temporary task data for printing
        const tempTaskData = {
            orderNumber: orderNumber,
            tagsQuantity: tagsQuantity,
            dateDue: document.getElementById('dueDateInput').value,
            description: document.getElementById('descriptionInput').value.trim()
        };
        
        // Determine person and date
        let person, dateKey;
        if (document.getElementById('personDateFields').classList.contains('hidden')) {
            person = this.currentOrderPerson;
            dateKey = this.currentOrderDate;
        } else {
            person = document.getElementById('assignPersonSelect').value;
            dateKey = document.getElementById('workDateInput').value;
        }
        
        // Close order modal and show tag printing modal
        this.getElement('orderModal').classList.add('hidden');
        this.showTagPrintingModalFromOrder(tempTaskData, person, dateKey);
    });

    const durationInput = document.getElementById('durationInput');
    durationInput.addEventListener('input', () => {
        const slots = parseInt(durationInput.value) || 2;
        const minutes = slots * 15;
        document.getElementById('durationMinutes').textContent = minutes;
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.duration-btn')) {
            const btn = e.target.closest('.duration-btn');
            const duration = btn.dataset.duration;
            const durationInput = document.getElementById('durationInput');
            durationInput.value = duration;
            durationInput.dispatchEvent(new Event('input'));
        }
    });

    this.updateCommonWords();
}
validateOrderData(orderNumber, dateDue, description, duration) {
    const validations = [];
    
    // Order number validation - this will block saving invalid formats
    const orderValidation = this.validateOrderNumber(orderNumber);
    if (!orderValidation.isValid) {
        validations.push(orderValidation.error);
    }
    
    // Description validation
    if (!description || description.trim().length < 3) {
        validations.push('Description must be at least 3 characters');
    }
    
    // Duration validation
    if (!duration || duration < 1 || duration > 32) {
        validations.push('Duration must be between 1 and 32 slots');
    }

    return {
        isValid: validations.length === 0,
        errors: validations
    };
}

            
            // Drag and Drop
            handleDragStart(e) {
                this.draggedElement = e.target;
                e.target.style.opacity = '0.5';
            }

            handleDragEnd(e) {
                e.target.style.opacity = '1';
                this.draggedElement = null;
            }

            handleDragOver(e) {
                e.preventDefault();
                e.currentTarget.classList.add('drag-over');
            }

            handleDragLeave(e) {
                e.currentTarget.classList.remove('drag-over');
            }

            handleDrop(e) {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');

                if (this.draggedElement) {
                    const newPerson = e.currentTarget.dataset.person;
                    const newDate = e.currentTarget.dataset.date;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    let slotPosition = Math.floor(y / 32);

                    const adjustedPosition = this.findNonCollidingPosition(newPerson, newDate, slotPosition, this.draggedElement.dataset.taskId);

                    this.moveTask(this.draggedElement.dataset.taskId, newPerson, adjustedPosition, newDate);
                }
            }
            
            findNonCollidingPosition(person, dateKey, slotPosition, taskId) {
                const existingTasks = this.tasks[dateKey]?.[person] || [];
                
                let taskDuration = 2;
                for (const date in this.tasks) {
                    for (const p in this.tasks[date]) {
                        const foundTask = this.tasks[date][p].find(t => t.id == taskId);
                        if (foundTask) {
                            taskDuration = foundTask.duration;
                            break;
                        }
                    }
                    if (taskDuration !== 2) break;
                }
                
                function hasCollision(pos) {
                    return existingTasks.some(task => {
                        if (task.id == taskId) return false;
                        return !(pos >= task.position + task.duration || pos + taskDuration <= task.position);
                    });
                }
                
                if (!hasCollision(slotPosition)) {
                    return Math.max(0, Math.min(slotPosition, 32 - taskDuration));
                }
                
                for (let pos = slotPosition; pos <= 32 - taskDuration; pos++) {
                    if (!hasCollision(pos)) return pos;
                }
                
                for (let pos = slotPosition - 1; pos >= 0; pos--) {
                    if (!hasCollision(pos)) return pos;
                }
                
                return Math.max(0, 32 - taskDuration);
            }
            
            findOptimalPosition(person, dateKey, duration) {
                const existingTasks = this.tasks[dateKey]?.[person] || [];
                
                function hasCollision(pos) {
                    return existingTasks.some(task => {
                        return !(pos >= task.position + task.duration || pos + duration <= task.position);
                    });
                }
                
                for (let pos = 0; pos <= 32 - duration; pos++) {
                    if (!hasCollision(pos)) {
                        return pos;
                    }
                }
                
                return Math.max(0, 32 - duration);
            }
            
            // Task Management
            async moveTask(taskId, newPerson, newPosition, newDateKey) {
                let foundTask = null;
                let oldPerson = null;
                let oldDateKey = null;

                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const taskIndex = this.tasks[dateKey][person].findIndex(t => t.id == taskId);
                        if (taskIndex !== -1) {
                            foundTask = this.tasks[dateKey][person].splice(taskIndex, 1)[0];
                            oldPerson = person;
                            oldDateKey = dateKey;
                            break;
                        }
                    }
                    if (foundTask) break;
                }

                if (foundTask) {
                    foundTask.position = Math.max(0, Math.min(newPosition, 32 - foundTask.duration));
                    
                    if (!this.tasks[newDateKey]) this.tasks[newDateKey] = {};
                    if (!this.tasks[newDateKey][newPerson]) this.tasks[newDateKey][newPerson] = [];
                    this.tasks[newDateKey][newPerson].push(foundTask);

                    this.renderWhiteboard();

                    if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                        try {
                            const updates = {
                                Person: newPerson,
                                Position: foundTask.position,
                                Date: newDateKey
                            };
                            
                            await this.updateTaskInAirtable(taskId, updates);
                            this.showSuccessToast('sync', 'Task');
                        } catch (error) {
                            this.showToast('Task moved locally. Sync failed: ' + error.message, 'warning');
                        }
                    } else {
                        this.showSuccessToast('update', 'Task');
                    }
                }
            }
            
            async toggleTaskCompletion(task) {
                let foundTask = null;
                
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const taskInArray = this.tasks[dateKey][person].find(t => t.id === task.id);
                        if (taskInArray) {
                            foundTask = taskInArray;
                            break;
                        }
                    }
                    if (foundTask) break;
                }
                
                if (!foundTask) {
                    this.showToast('Task not found', 'error');
                    return;
                }
                
                const newStatus = !foundTask.completed;
                foundTask.completed = newStatus;
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    try {
                        await this.updateTaskInAirtable(task.id, { Completed: newStatus });
                    } catch (error) {
                        foundTask.completed = !newStatus;
                        this.showToast('Failed to update completion status', 'error');
                        this.renderWhiteboard();
                        return;
                    }
                }
                
                this.renderWhiteboard();
                this.showToast(`Order #${task.orderNumber} marked as ${newStatus ? 'complete' : 'incomplete'}`, 'success');
            }
            
            // Modal Functions
showNewOrderModal() {
    this.resetOrderModal();
    document.getElementById('orderModalTitle').textContent = 'Add New Order';
    document.getElementById('personDateFields').classList.remove('hidden');
    
    this.populatePeopleDropdown('assignPersonSelect');
    
    const workDateStr = this.dateToLocalDateString(this.currentDate);
    document.getElementById('workDateInput').value = workDateStr;
    this.updateWorkDateDisplay(workDateStr);
    
    this.loadAndDisplayCustomText();
    
    // Setup "new" placeholder behavior AFTER reset
    const orderNumberInput = document.getElementById('orderNumberInput');
    orderNumberInput.value = 'new';
    orderNumberInput.style.color = '#9ca3af';
    orderNumberInput.style.fontStyle = 'italic';
    
    // Clear "new" on first focus
    orderNumberInput.addEventListener('focus', function clearNew() {
        if (this.value === 'new') {
            this.value = '';
            this.style.color = '';
            this.style.fontStyle = 'normal';
        }
        // Remove this listener after first use
        this.removeEventListener('focus', clearNew);
    });
    
    this.handleModalAction('orderModal', 'show');
    // Don't focus immediately since that would clear "new"
    
    this.updateCommonWords();
}
            
showOrderModalForPerson(person, date = null) {
    this.resetOrderModal();
    document.getElementById('orderModalTitle').textContent = `Add Order for ${person}`;
    document.getElementById('personDateFields').classList.add('hidden');
    
    this.currentOrderPerson = person;
    this.currentOrderDate = date || this.dateToLocalDateString(this.currentDate);
    
    this.loadAndDisplayCustomText();
    
    // Setup "new" placeholder behavior AFTER reset
    const orderNumberInput = document.getElementById('orderNumberInput');
    orderNumberInput.value = 'new';
    orderNumberInput.style.color = '#9ca3af';
    orderNumberInput.style.fontStyle = 'italic';
    
    // Clear "new" on first focus
    orderNumberInput.addEventListener('focus', function clearNew() {
        if (this.value === 'new') {
            this.value = '';
            this.style.color = '';
            this.style.fontStyle = 'normal';
        }
        // Remove this listener after first use
        this.removeEventListener('focus', clearNew);
    });
    
    this.handleModalAction('orderModal', 'show');
    // Don't focus immediately since that would clear "new"
    
    this.updateCommonWords();
}
            
            editTask(task) {
                let currentPerson = null;
                let currentDateKey = null;
                
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const foundTask = this.tasks[dateKey][person].find(t => t.id === task.id);
                        if (foundTask) {
                            currentPerson = person;
                            currentDateKey = dateKey;
                            break;
                        }
                    }
                    if (currentPerson) break;
                }
                
                this.isEditingTask = true;
                this.editingTaskId = task.id;
                this.originalTaskData = { task: {...task}, person: currentPerson, dateKey: currentDateKey };
                
                document.getElementById('orderModalTitle').textContent = 'Edit Order';
                document.getElementById('personDateFields').classList.remove('hidden');
                document.getElementById('completionStatusField').classList.remove('hidden');
                
                this.populatePeopleDropdown('assignPersonSelect');
                document.getElementById('assignPersonSelect').value = currentPerson;
                
                document.getElementById('workDateInput').value = currentDateKey;
		this.updateWorkDateDisplay(currentDateKey);
                document.getElementById('orderNumberInput').value = task.orderNumber;
                document.getElementById('dueDateInput').value = this.formatDateForInput(task.dateDue);
                document.getElementById('descriptionInput').value = task.description;
                document.getElementById('durationInput').value = task.duration;
                document.getElementById('tagsQuantityInput').value = task.tagsQuantity || 1;
                
                this.updateCompletionStatusDisplay(task.completed);
                
                this.loadAndDisplayCustomText();
                
                this.handleModalAction('orderModal', 'show');
                this.updateCommonWords();
            }
            
            formatDateForInput(date) {
                if (date instanceof Date) {
                    return date.toISOString().split('T')[0];
                } else if (typeof date === 'string') {
                    return date.includes('T') ? date.split('T')[0] : date;
                }
                return '';
            }
            
            updateCompletionStatusDisplay(isCompleted) {
                const statusText = document.getElementById('completionStatusText');
                const toggleBtn = document.getElementById('toggleCompletionBtn');
                
                if (isCompleted) {
                    statusText.innerHTML = '<span class="text-green-600">✅ Completed</span>';
                    toggleBtn.className = 'px-4 py-2 rounded-lg font-medium transition-colors bg-yellow-500 text-white hover:bg-yellow-600';
                    toggleBtn.innerHTML = '<span>Mark Incomplete</span>';
                } else {
                    statusText.innerHTML = '<span class="text-yellow-600">⏳ In Progress</span>';
                    toggleBtn.className = 'px-4 py-2 rounded-lg font-medium transition-colors bg-green-500 text-white hover:bg-green-600';
                    toggleBtn.innerHTML = '<span>Mark Complete</span>';
                }
                
                const newBtn = toggleBtn.cloneNode(true);
                toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
                
                newBtn.addEventListener('click', async () => {
                    for (const dateKey in this.tasks) {
                        for (const person in this.tasks[dateKey]) {
                            const foundTask = this.tasks[dateKey][person].find(t => t.id === this.editingTaskId);
                            if (foundTask) {
                                await this.toggleTaskCompletion(foundTask);
                                this.updateCompletionStatusDisplay(foundTask.completed);
                                return;
                            }
                        }
                    }
                });
            }
            
            resetOrderModal() {
                this.isEditingTask = false;
                this.editingTaskId = null;
                this.originalTaskData = null;
                this.currentOrderPerson = null;
                this.currentOrderDate = null;
                
                document.getElementById('personDateFields').classList.add('hidden');
                document.getElementById('completionStatusField').classList.add('hidden');
                
                document.getElementById('orderNumberInput').value = '';
                document.getElementById('dueDateInput').value = '';
                document.getElementById('descriptionInput').value = '';
                document.getElementById('durationInput').value = '2';
                document.getElementById('durationMinutes').textContent = '30';
            }
            
async saveOrder() {
    const orderNumber = this.sanitizeInput(this.getElement('orderNumberInput').value.trim());
    const dateDue = this.getElement('dueDateInput').value;
    const description = this.sanitizeInput(this.getElement('descriptionInput').value.trim());
    const duration = parseInt(this.getElement('durationInput').value);
    const tagsQuantity = parseInt(this.getElement('tagsQuantityInput').value) || 1;

    // Enhanced validation
    const validation = this.validateOrderData(orderNumber, dateDue, description, duration);
    if (!validation.isValid) {
        this.showErrorToast('validation', validation.errors[0]);
        return;
    }

    let targetPerson, targetDateKey;
    
    if (this.getElement('personDateFields').classList.contains('hidden')) {
        targetPerson = this.currentOrderPerson;
        targetDateKey = this.currentOrderDate;
    } else {
        targetPerson = this.getElement('assignPersonSelect').value;
        targetDateKey = this.getElement('workDateInput').value;
    }

    // Check for duplicates (skip if editing the same task)
    const excludeTaskId = this.isEditingTask ? this.editingTaskId : null;
    const duplicates = this.checkForDuplicateOrderNumber(orderNumber, excludeTaskId);
    
    if (duplicates.length > 0) {
        // Show confirmation dialog and wait for user response
        this.showDuplicateOrderConfirmation(duplicates, () => {
            // User confirmed - proceed with original save logic
            this.proceedWithOrderSave(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey);
        });
        return; // Stop here until user confirms
    }

    // No duplicates - proceed with original save logic
    this.proceedWithOrderSave(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey);
}

async proceedWithOrderSave(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey) {
    // Use performance tracking (original logic preserved)
    try {
        if (this.isEditingTask) {
            await this.performAsyncOperation('updateOrder', 
                () => this.updateExistingTask(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey)
            );
        } else {
            await this.performAsyncOperation('createOrder', 
                () => this.createNewTask(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey)
            );
        }
        
        this.handleModalAction('orderModal', 'hide');
        this.renderWhiteboard();
    } catch (error) {
        // Error already handled in performAsyncOperation
    }
}
            
            async updateExistingTask(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey) {
                let currentTask = null;
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const foundTask = this.tasks[dateKey][person].find(t => t.id === this.editingTaskId);
                        if (foundTask) {
                            currentTask = foundTask;
                            break;
                        }
                    }
                    if (currentTask) break;
                }

                const originalPerson = this.originalTaskData?.person;
                const originalDateKey = this.originalTaskData?.dateKey;
                const personChanged = targetPerson !== originalPerson;
                const dateChanged = targetDateKey !== originalDateKey;
                
                let newPosition;
                if (personChanged || dateChanged) {
                    newPosition = this.findOptimalPosition(targetPerson, targetDateKey, duration);
                } else {
                    newPosition = currentTask?.position || 0;
                }

                const updatedTask = {
                    id: this.editingTaskId,
                    orderNumber,
                    dateDue,
                    description,
                    duration,
                    tagsQuantity,
                    position: newPosition,
                    completed: currentTask?.completed || false
                };

                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Updating order...');
                    try {
const updates = {
    OrderNumber: orderNumber,
    Description: description,
    Duration: duration,
    TagsQuantity: tagsQuantity,
    Person: targetPerson,
    Date: targetDateKey,
    Position: newPosition,
    Completed: updatedTask.completed
};

// Only include DateDue if it exists and is not empty
if (dateDue && dateDue.trim() !== '') {
    updates.DateDue = dateDue;
}
                        await this.updateTaskInAirtable(this.editingTaskId, updates);
                        this.showToast('✅ Order updated and verified in Airtable!', 'success');
                    } catch (error) {
                        const friendlyMessage = this.getFriendlyErrorMessage(error.message);
                        this.showToast(`❌ ${friendlyMessage}`, 'error');
                        return;
                    } finally {
                        this.hideLoading();
                    }
                }

                if (this.originalTaskData) {
                    const originalDateKey = this.originalTaskData.dateKey;
                    const originalPerson = this.originalTaskData.person;
                    
                    if (this.tasks[originalDateKey] && this.tasks[originalDateKey][originalPerson]) {
                        const taskIndex = this.tasks[originalDateKey][originalPerson].findIndex(t => t.id === this.editingTaskId);
                        if (taskIndex !== -1) {
                            this.tasks[originalDateKey][originalPerson].splice(taskIndex, 1);
                        }
                    }
                }

                this.addTaskToSpecificDate(targetPerson, updatedTask, targetDateKey);
            }
            
            async createNewTask(orderNumber, dateDue, description, duration, tagsQuantity, targetPerson, targetDateKey) {
                const workDate = this.parseDateString(targetDateKey);
                const correctedDateKey = this.dateToLocalDateString(workDate);
                
                console.log('Creating new task:', {
                    orderNumber,
                    dateDue,
                    description,
                    duration,
                    tagsQuantity,
                    targetPerson,
                    correctedDateKey
                });
                
const task = {
    id: Date.now() + Math.random(),
    orderNumber,
    dateDue: (dateDue && dateDue.trim()) ? dateDue : null,  // ✅ Send null instead of empty string
    description,
    duration,
    tagsQuantity,
    position: this.findOptimalPosition(targetPerson, correctedDateKey, duration),
    completed: false
};

                // Add to local state first
                this.addTaskToSpecificDate(targetPerson, task, correctedDateKey);
                this.renderWhiteboard();

                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Saving to Airtable...');
                    try {
                        console.log('Sending task to Airtable:', task);
                        const recordId = await this.createTaskInAirtable(task, targetPerson, correctedDateKey);
                        console.log('Task created in Airtable with ID:', recordId);
                        
                        // Update the task ID to the Airtable record ID
                        task.id = recordId;
                        
                        this.showToast('✅ Order saved and verified in Airtable!', 'success');
                    } catch (error) {
                        console.error('Failed to create task in Airtable:', error);
                        const friendlyMessage = this.getFriendlyErrorMessage(error.message);
                        this.showToast(`❌ ${friendlyMessage}`, 'error');
                        
                        // Remove the task from local state since Airtable save failed
                        if (this.tasks[correctedDateKey] && this.tasks[correctedDateKey][targetPerson]) {
                            const taskIndex = this.tasks[correctedDateKey][targetPerson].findIndex(t => t.id === task.id);
                            if (taskIndex !== -1) {
                                this.tasks[correctedDateKey][targetPerson].splice(taskIndex, 1);
                            }
                        }
                        this.renderWhiteboard();
                        return;
                    } finally {
                        this.hideLoading();
                    }
                } else {
                    this.showToast('✅ Order added successfully!', 'success');
                }
                
                console.log('Final task state:', task);
                console.log('Current tasks for person:', this.tasks[correctedDateKey]?.[targetPerson]);
            }
            
            addTaskToSpecificDate(person, task, dateKey) {
                if (!this.tasks[dateKey]) this.tasks[dateKey] = {};
                if (!this.tasks[dateKey][person]) this.tasks[dateKey][person] = [];
                this.tasks[dateKey][person].push(task);
            }

updateQuickNumbers() {
    const container = document.getElementById('quickNumbersList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create numbers 1-9 and some special numbers
    const numbers = [
        1, 2, 3, 4, 5, 6, 7, 8, 9
    ];
    
    numbers.forEach(number => {
        const btn = document.createElement('button');
        btn.type = 'button';
btn.className = 'px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-mono';
        btn.textContent = number.toString();
        btn.addEventListener('click', () => {
            this.insertNumberIntoDescription(number);
        });
        container.appendChild(btn);
    });
}

insertNumberIntoDescription(number) {
    const textarea = document.getElementById('descriptionInput');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    
    // Insert the number at cursor position
    const newText = currentText.slice(0, start) + number + currentText.slice(end);
    textarea.value = newText;
    
    // Set cursor position after the inserted number
    const newCursorPos = start + number.toString().length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Focus back to textarea
    textarea.focus();
}


            
updateCommonWords() {
    // Update numbers first
    this.updateQuickNumbers();
    
    // Then update common words
    const container = document.getElementById('commonWordsList');
    if (!container) return;
    
    const now = Date.now();
    if (this.cachedCommonWords && (now - this.lastCommonWordsUpdate) < 30000) {
        this.renderCommonWords(this.cachedCommonWords, container);
        return;
    }
    
    const commonWords = this.generateCommonWords();
    this.cachedCommonWords = commonWords;
    this.lastCommonWordsUpdate = now;
    
    this.renderCommonWords(commonWords, container);
}
            
            renderCommonWords(commonWords, container) {
                container.innerHTML = '';
                
                commonWords.forEach(word => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors';
                    btn.textContent = word;
                    btn.addEventListener('click', () => {
                        const textarea = document.getElementById('descriptionInput');
                        const currentText = textarea.value;
                        textarea.value = currentText ? currentText + ' ' + word : word;
                        textarea.focus();
                    });
                    container.appendChild(btn);
                });
            }
            
generateCommonWords() {
    // Use cached results if available and not too old (30 seconds)
    const now = Date.now();
    if (this.cachedCommonWords && (now - this.lastCommonWordsUpdate) < 30000) {
        return this.cachedCommonWords;
    }
    
    // Default words to use if no data or insufficient words found
    const defaultWords = ['hem', 'pants', 'dress', 'rush', 'take-in', 'sleeve', 'taper'];
    
    // Process descriptions only if we have tasks
    const taskCount = Object.keys(this.tasks).reduce((count, dateKey) => {
        return count + Object.values(this.tasks[dateKey]).flat().length;
    }, 0);
    
    if (taskCount === 0) {
        return defaultWords;
    }
    
    // Process descriptions more efficiently
    const wordCount = {};
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    // Single loop through all tasks
    Object.values(this.tasks).forEach(dateData => {
        Object.values(dateData).forEach(personTasks => {
            personTasks.forEach(task => {
                if (!task.description) return;
                
                // Extract words and count frequencies in one pass
                const words = task.description.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
                words.forEach(word => {
                    if (!stopWords.has(word)) {
                        wordCount[word] = (wordCount[word] || 0) + 1;
                    }
                });
            });
        });
    });
    
    // Get top words
    let sortedWords = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word]) => word);
    
    // Fill with default words if needed
    if (sortedWords.length < 8) {
        for (const word of defaultWords) {
            if (sortedWords.length >= 8) break;
            if (!sortedWords.includes(word)) {
                sortedWords.push(word);
            }
        }
    }
    
    // Cache the results
    this.cachedCommonWords = sortedWords;
    this.lastCommonWordsUpdate = now;
    
    return sortedWords;
}
     
            // Settings Modal Functions
showSettingsModal() {
    // First: Show the modal so elements exist
    this.getElement('settingsModal').classList.remove('hidden');
    this.switchSettingsTab('database');
    
    // Then: Populate the fields (now they exist)
    document.getElementById('airtableApiKey').value = this.airtableConfig.apiKey;
    document.getElementById('airtableBaseId').value = this.airtableConfig.baseId;
    document.getElementById('peopleTableName').value = this.airtableConfig.tablesConfig.people;
    document.getElementById('tasksTableName').value = this.airtableConfig.tablesConfig.tasks;
    document.getElementById('dueDateOffsetSetting').value = this.getDueDateOffset();
}
            
            switchSettingsTab(tab) {
                const databaseTab = document.getElementById('databaseTab');
                const peopleTab = document.getElementById('peopleTab');
                const editTextTab = document.getElementById('editTextTab');
                const databaseContent = document.getElementById('databaseTabContent');
                const peopleContent = document.getElementById('peopleTabContent');
                const editTextContent = document.getElementById('editTextTabContent');
                
                databaseTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 rounded-t';
                peopleTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 rounded-t';
                editTextTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500  hover:text-gray-700  rounded-t';
                databaseContent.classList.add('hidden');
                peopleContent.classList.add('hidden');
                editTextContent.classList.add('hidden');
                
                if (tab === 'database') {
                    databaseTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary bg-gray-50  rounded-t';
                    databaseContent.classList.remove('hidden');
                } else if (tab === 'people') {
                    peopleTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary bg-gray-50  rounded-t';
                    peopleContent.classList.remove('hidden');
                    this.updateCurrentPeopleList();
                } else if (tab === 'editText') {
                    editTextTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary bg-gray-50  rounded-t';
                    editTextContent.classList.remove('hidden');
                    this.loadEditTextContent();
                }
            }
            
            updateCurrentPeopleList() {
                const container = document.getElementById('currentPeopleList');
                if (!container) return;
                
                container.innerHTML = '';
                
                if (this.people.length === 0) {
                    container.innerHTML = '<p class="text-gray-500  text-sm">No people added yet.</p>';
                    return;
                }
                
                this.people.forEach(person => {
                    const personCard = document.createElement('div');
                    personCard.className = 'flex items-center justify-between p-3 bg-gray-50  rounded-lg border';
                    
                    const capacity = this.peopleCapacity[person] || {};
                    const totalSlots = Object.values(capacity).reduce((sum, slots) => sum + (slots || 0), 0);
                    const avgHours = Math.floor(totalSlots * 15 / 60 / 7 * 10) / 10;
                    
                    personCard.innerHTML = `
                        <div class="flex-1">
                            <div class="font-medium text-gray-900 ">${person}</div>
                            <div class="text-sm text-gray-500 ">
                                ${totalSlots} total slots/week (~${avgHours}h avg/day)
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="edit-person-capacity-btn px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors" data-person="${person}">
                                Edit Capacity
                            </button>
                            <button class="capacity-overrides-btn px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors" data-person="${person}">
                                Date Overrides
                            </button>
                            <button class="remove-person-btn px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors" data-person="${person}">
                                Remove
                            </button>
                        </div>
                    `;
                    
                    const editBtn = personCard.querySelector('.edit-person-capacity-btn');
                    const removeBtn = personCard.querySelector('.remove-person-btn');
                    
                    editBtn.addEventListener('click', () => {
                        this.showCapacityModal(person);
                    });
                    
                    const overridesBtn = personCard.querySelector('.capacity-overrides-btn');
                    overridesBtn.addEventListener('click', () => {
                        this.showCapacityOverridesModal(person);
                    });
                    
                    removeBtn.addEventListener('click', () => {
                        this.showRemovePersonConfirmation(person);
                    });
                    
                    container.appendChild(personCard);
                });
            }
            
            setupPersonCapacityInputs() {
                const container = document.getElementById('personCapacityInputs');
                if (!container) return;
                
                container.innerHTML = '';
                this.DAYS_OF_WEEK.forEach(day => {
                    const div = document.createElement('div');
                    div.innerHTML = `
                        <span class="block text-sm font-medium mb-1">${day}:</span>
                        <input type="number" id="newPersonCapacity${day}" min="0" max="32" value="16" 
                               class="w-full p-2 text-base border border-gray-300  rounded-lg bg-white  focus:ring-2 focus:ring-primary focus:border-transparent">
                    `;
                    container.appendChild(div);
                });
            }
            
            applyCapacityPreset(capacities) {
                this.DAYS_OF_WEEK.forEach(day => {
                    const input = document.getElementById(`newPersonCapacity${day}`);
                    if (input) input.value = capacities[day] || 0;
                });
            }
            
            clearPersonForm() {
                document.getElementById('personNameInput').value = '';
                this.DAYS_OF_WEEK.forEach(day => {
                    const input = document.getElementById(`newPersonCapacity${day}`);
                    if (input) input.value = 16;
                });
                document.getElementById('personActiveInput').checked = true;
            }
            
            async addPerson() {
                const name = document.getElementById('personNameInput').value.trim();
                const isActive = document.getElementById('personActiveInput').checked;
                
                if (!name) {
                    this.showToast('Please enter a person name', 'error');
                    return;
                }
                
                const weeklyCapacity = {};
                this.DAYS_OF_WEEK.forEach(day => {
                    const input = document.getElementById(`newPersonCapacity${day}`);
                    const capacity = parseInt(input.value) || 0;
                    weeklyCapacity[day] = Math.max(0, Math.min(capacity, 32));
                });

                if (isActive) {
                    this.people.push(name);
                }
                this.peopleCapacity[name] = weeklyCapacity;
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Adding person...');
                    try {
                        await this.createPersonInAirtable(name, weeklyCapacity, isActive);
                        const statusMsg = isActive ? `${name} added to schedule!` : `${name} profile created`;
                        this.showToast(statusMsg, 'success');
                    } catch (error) {
                        this.showToast(`Failed to add person: ${error.message}`, 'error');
                    } finally {
                        this.hideLoading();
                    }
                }
                
                this.clearPersonForm();
                if (isActive) {
                    this.renderWhiteboard();
                }
            }
            
            async testAirtableConnection() {
                const apiKey = document.getElementById('airtableApiKey').value.trim();
                const baseId = document.getElementById('airtableBaseId').value.trim();
                
                if (!apiKey || !baseId) {
                    this.showConnectionStatus('Please enter both API Key and Base ID', true);
                    return;
                }

                try {
                    const response = await fetch(`https://api.airtable.com/v0/${baseId}/People`, {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        this.showConnectionStatus('✓ Connection successful!');
                    } else {
                        const error = await response.json();
                        this.showConnectionStatus(`Connection failed: ${error.error?.message || 'Unknown error'}`, true);
                    }
                } catch (error) {
                    this.showConnectionStatus(`Connection failed: ${error.message}`, true);
                }
            }
            
            showConnectionStatus(message, isError = false) {
                const statusDiv = document.getElementById('connectionStatus');
                statusDiv.textContent = message;
                statusDiv.className = `p-3 rounded-lg text-sm ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
                statusDiv.classList.remove('hidden');
            }
            
            async saveSettingsAndConnect() {
                this.airtableConfig.apiKey = document.getElementById('airtableApiKey').value.trim();
                this.airtableConfig.baseId = document.getElementById('airtableBaseId').value.trim();
                this.airtableConfig.tablesConfig.people = document.getElementById('peopleTableName').value.trim();
                this.airtableConfig.tablesConfig.tasks = document.getElementById('tasksTableName').value.trim();

    this.saveDueDateOffset(parseInt(document.getElementById('dueDateOffsetSetting').value) || 0);

                if (!this.airtableConfig.apiKey || !this.airtableConfig.baseId) {
                    this.showConnectionStatus('Please enter both API Key and Base ID', true);
                    return;
                }

                this.handleModalAction('settingsModal', 'hide');
                this.showLoading('Loading data from Airtable...');

                try {
                    await this.loadAllDataFromAirtable();
                    this.showSuccessToast('connect');
                    this.renderWhiteboard();
                    await this.saveConfigToIndexedDB();
                } catch (error) {
                    this.showToast(`Failed to load data: ${error.message}`, 'error');
                } finally {
                    this.hideLoading();
                }
            }
            
            downloadConfig() {
                const config = {
                    apiKey: this.airtableConfig.apiKey,
                    baseId: this.airtableConfig.baseId,
                    tablesConfig: this.airtableConfig.tablesConfig,
                    appVersion: '1.0',
                    exportDate: new Date().toISOString()
                };
                
                const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `task-scheduler-config-${config.baseId || 'backup'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showSuccessToast('save', 'Configuration');
            }
            
            async uploadConfig(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                try {
                    const text = await file.text();
                    const config = JSON.parse(text);
                    
                    if (!config.apiKey || !config.baseId) {
                        this.showErrorToast('validation', 'Invalid config file');
                        return;
                    }
                    
                    this.airtableConfig.apiKey = config.apiKey;
                    this.airtableConfig.baseId = config.baseId;
                    if (config.tablesConfig) {
                        this.airtableConfig.tablesConfig = config.tablesConfig;
                    }
                    
                    document.getElementById('airtableApiKey').value = config.apiKey;
                    document.getElementById('airtableBaseId').value = config.baseId;
                    document.getElementById('peopleTableName').value = config.tablesConfig?.people || 'People';
                    document.getElementById('tasksTableName').value = config.tablesConfig?.tasks || 'Tasks';
                    
                    this.showConnectionStatus('✓ Configuration loaded from file!');
                    this.showToast('Config loaded! Click "Connect & Load" to proceed.', 'success');
                } catch (error) {
                    this.showToast(`Failed to load config: ${error.message}`, 'error');
                }
                
                event.target.value = '';
            }
            
            // Search Modal Functions
            showSearchModal() {
                this.populateSearchPersonFilter();
                this.handleModalAction('searchModal', 'show');
                document.getElementById('searchInput').focus();
            }
            
            populateSearchPersonFilter() {
                this.populatePeopleDropdown('searchPersonFilter', true);
            }
            
            populateReportPersonFilter() {
                this.populatePeopleDropdown('reportPersonFilter', true);
            }
            
            performSearch() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
                const resultsContainer = document.getElementById('searchResults');
                
                if (!searchTerm) {
                    this.showEmptySearchState(resultsContainer);
                    return;
                }
                
                const results = this.searchTasks(searchTerm);
                this.displaySearchResults(results, resultsContainer);
            }
            
            showEmptySearchState(container) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500 ">
                        <p class="text-lg font-medium">Enter search terms</p>
                    </div>
                `;
            }
            
            searchTasks(searchTerm) {
                const allResults = [];
                const filters = this.getSearchFilters();
                
                Object.keys(this.tasks).forEach(dateKey => {
                    Object.keys(this.tasks[dateKey]).forEach(person => {
                        this.tasks[dateKey][person].forEach(task => {
                            if (this.matchesSearchCriteria(task, person, dateKey, searchTerm, filters)) {
                                allResults.push({
                                    task,
                                    person,
                                    dateKey,
                                    dateDisplay: new Date(dateKey).toLocaleDateString()
                                });
                            }
                        });
                    });
                });
                
                return allResults.sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));
            }
            
            getSearchFilters() {
                return {
                    person: document.getElementById('searchPersonFilter').value,
                    status: document.getElementById('searchStatusFilter').value,
                    dueStatus: document.getElementById('searchDueFilter').value
                };
            }
            
            matchesSearchCriteria(task, person, dateKey, searchTerm, filters) {
                const orderNumber = task.orderNumber.toLowerCase();
                const description = task.description.toLowerCase();
                const personName = person.toLowerCase();
                
                const matchesText = orderNumber.includes(searchTerm) || 
                                  description.includes(searchTerm) || 
                                  personName.includes(searchTerm);
                
                if (!matchesText) return false;
                
                if (filters.person !== 'all' && person !== filters.person) return false;
                
                if (filters.status !== 'all') {
                    const isComplete = task.completed || false;
                    if ((filters.status === 'complete' && !isComplete) || 
                        (filters.status === 'incomplete' && isComplete)) {
                        return false;
                    }
                }
                
                const workDateFrom = document.getElementById('searchWorkDateFrom').value;
                const workDateTo = document.getElementById('searchWorkDateTo').value;
                
                if (workDateFrom && dateKey < workDateFrom) return false;
                if (workDateTo && dateKey > workDateTo) return false;
                
                return true;
            }
            
            displaySearchResults(results, container) {
                if (results.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-8 text-gray-500 ">
                            <p class="text-lg font-medium">No orders found</p>
                        </div>
                    `;
                    return;
                }
                
                const scrollContainer = document.createElement('div');
                scrollContainer.className = 'space-y-2 max-h-96 overflow-y-auto';
                
                results.forEach(result => {
                    const item = this.createSearchResultItem(result);
                    scrollContainer.appendChild(item);
                });
                
                container.innerHTML = '';
                container.appendChild(scrollContainer);
                
                const statsDiv = document.createElement('div');
                statsDiv.className = 'text-center py-2 text-sm text-gray-500  border-t border-gray-200  mt-4';
                statsDiv.textContent = `Found ${results.length} order${results.length !== 1 ? 's' : ''}`;
                container.appendChild(statsDiv);
            }
            
createSearchResultItem(result) {
    const { task, person, dateKey, dateDisplay } = result;
    
    const dueDateDisplay = this.formatDateForDisplay(task.dateDue);
    const dueDateColor = new Date(task.dateDue) < new Date() ? 'text-red-500' : 'text-green-500';
    
    // Fix timezone issue - use proper date formatting
    const workDate = this.parseDateString(dateKey);
    const correctWorkDateDisplay = workDate ? this.formatDateForDisplay(workDate) : dateDisplay;
    
    // Determine status
    let status, statusClass;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDueDate = new Date(task.dateDue);
    taskDueDate.setHours(0, 0, 0, 0);
    
    if (task.completed) {
        status = '✅ Complete';
        statusClass = 'text-green-600';
    } else if (taskDueDate < today) {
        status = '⚠️ Overdue';
        statusClass = 'text-red-600';
    } else {
        status = '⏳ Incomplete';
        statusClass = 'text-blue-600';
    }
    
    const item = document.createElement('div');
    item.className = 'p-4 border border-gray-200  rounded-lg hover:bg-gray-50 transition-colors';
    
    item.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="text-lg font-semibold text-primary">#${task.orderNumber}</div>
            <div class="text-sm text-gray-500 ">${task.duration * 15} min</div>
        </div>
        <div class="text-sm text-gray-600  mb-2">${task.description}</div>
        <div class="flex justify-between items-center text-xs mb-2">
            <div class="flex space-x-4">
                <span class="text-gray-500 ">📅 Work: ${correctWorkDateDisplay}</span>
                <span class="text-gray-500 ">👤 ${person}</span>
            </div>
            <div class="${dueDateColor}">Due: ${dueDateDisplay}</div>
        </div>
        <div class="flex justify-between items-center">
            <span class="flex items-center cursor-pointer">
                <input type="checkbox" class="search-result-checkbox w-4 h-4 text-primary border border-gray-300 rounded focus:ring-2 focus:ring-primary mr-2" 
                       data-task-id="${task.id}" 
                       data-person="${person}" 
                       data-date="${dateKey}"
                       ${task.completed ? 'checked' : ''}>
                <span class="text-sm font-medium ${statusClass}">${status}</span>
            </span>
            <div class="text-xs text-blue-500 font-medium cursor-pointer hover:underline" onclick="this.closest('.p-4').dispatchEvent(new Event('dblclick'))">
                Double-click to navigate
            </div>
        </div>
    `;
    
    // Add checkbox event listener
    const checkbox = item.querySelector('.search-result-checkbox');
    checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        
        const taskId = checkbox.dataset.taskId;
        const person = checkbox.dataset.person;
        const dateKey = checkbox.dataset.date;
        
        // Find the task and toggle its completion
        let foundTask = null;
        if (this.tasks[dateKey] && this.tasks[dateKey][person]) {
            foundTask = this.tasks[dateKey][person].find(t => t.id == taskId);
            if (foundTask) {
                await this.toggleTaskCompletion(foundTask);
                // Refresh search results
                this.performSearch();
            }
        }
    });
    
    item.addEventListener('dblclick', () => {
        this.handleModalAction('searchModal', 'hide');
        
        const [year, month, day] = dateKey.split('-');
        this.currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        this.updateDateDisplay();
        this.renderWhiteboard();
        
        setTimeout(() => this.highlightOrder(task.orderNumber, person), 200);
    });
    
    return item;
}
            
            formatDateForDisplay(date) {
                if (date instanceof Date) {
                    return date.toLocaleDateString();
                } else if (typeof date === 'string') {
                    const dateStr = date.includes('T') ? date.split('T')[0] : date;
                    const [year, month, day] = dateStr.split('-');
                    return new Date(year, month - 1, day).toLocaleDateString();
                }
                return 'Invalid Date';
            }
            
            highlightOrder(orderNumber, person) {
                const taskCards = document.querySelectorAll('.task-card');
                
                taskCards.forEach(card => {
                    const cardOrderText = card.querySelector('.text-primary').textContent;
                    const cardOrderNumber = cardOrderText.replace('#', '');
                    const cardPerson = card.closest('.person-column').dataset.person;
                    
                    if (cardOrderNumber === orderNumber && cardPerson === person) {
                        card.classList.add('highlight-order');
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        setTimeout(() => {
                            card.classList.remove('highlight-order');
                        }, 3000);
                    }
                });
            }
            
            setSearchDateRange(range) {
                const today = new Date();
                let startDate, endDate;
                
                if (range === 'today') {
                    startDate = endDate = this.dateToLocalDateString(today);
                } else if (range === 'week') {
                    const startOfWeek = new Date(today);
                    startOfWeek.setDate(today.getDate() - today.getDay());
                    const endOfWeek = new Date(today);
                    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
                    startDate = this.dateToLocalDateString(startOfWeek);
                    endDate = this.dateToLocalDateString(endOfWeek);
                } else if (range === 'all') {
                    startDate = endDate = '';
                }
                
                document.getElementById('searchWorkDateFrom').value = startDate;
                document.getElementById('searchWorkDateTo').value = endDate;
            }
            
            clearSearchFilters() {
                document.getElementById('searchPersonFilter').value = 'all';
                document.getElementById('searchStatusFilter').value = 'all';
                document.getElementById('searchDueFilter').value = 'all';
                document.getElementById('searchWorkDateFrom').value = '';
                document.getElementById('searchWorkDateTo').value = '';
            }
            
            // Reports Modal Functions
            showReportsModal() {
                this.populateReportPersonFilter();
                this.setReportDefaultDates();
                this.handleModalAction('reportsModal', 'show');
            }
            
            populateReportPersonFilter() {
                const select = document.getElementById('reportPersonFilter');
                select.innerHTML = '<option value="all">All People</option>';
                this.people.forEach(person => {
                    const option = document.createElement('option');
                    option.value = person;
                    option.textContent = person;
                    select.appendChild(option);
                });
            }
            
            setReportDefaultDates() {
                const today = new Date();
                
                document.getElementById('reportStartDate').value = this.dateToLocalDateString(today);
                document.getElementById('reportEndDate').value = this.dateToLocalDateString(today);
            }
            
            setReportDateRange(range) {
                const today = new Date();
                let startDate, endDate;
                
                if (range === 'today') {
                    startDate = endDate = this.dateToLocalDateString(today);
                } else if (range === 'tomorrow') {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(today.getDate() + 1);
                    startDate = endDate = this.dateToLocalDateString(tomorrow);
                } else if (range === 'week') {
                    const startOfWeek = new Date(today);
                    startOfWeek.setDate(today.getDate() - today.getDay());
                    const endOfWeek = new Date(today);
                    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
                    startDate = this.dateToLocalDateString(startOfWeek);
                    endDate = this.dateToLocalDateString(endOfWeek);
                } else if (range === 'month') {
                    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    startDate = this.dateToLocalDateString(startOfMonth);
                    endDate = this.dateToLocalDateString(endOfMonth);
                }
                
                document.getElementById('reportStartDate').value = startDate;
                document.getElementById('reportEndDate').value = endDate;
            }
            
            generateReport(statusFilter = 'all') {
                const selectedPerson = document.getElementById('reportPersonFilter').value;
                const startDate = document.getElementById('reportStartDate').value;
                const endDate = document.getElementById('reportEndDate').value;

                if (!startDate || !endDate) {
                    this.showErrorToast('validation', 'Please select both start and end dates');
                    return;
                }

                const reportData = this.collectReportData(selectedPerson, startDate, endDate);
                
let filteredData = reportData;
if (statusFilter === 'incomplete') {
    filteredData = reportData.filter(item => !item.task.completed);
} else if (statusFilter === 'completed') {
    filteredData = reportData.filter(item => item.task.completed);
} else if (statusFilter === 'overdue') {
    // For overdue filter: search within the loaded data range only
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];
    
    filteredData = [];
    
    // Calculate the loaded date range based on settings
    const weeksBack = this.dataLoadSettings.weeksBack || 2;
    const weeksForward = this.dataLoadSettings.weeksForward || 4;
    
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - (weeksBack * 7));
    const rangeStartString = this.dateToLocalDateString(rangeStart);
    
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + (weeksForward * 7));
    const rangeEndString = this.dateToLocalDateString(rangeEnd);
    
    // Only search within the loaded data range
    Object.keys(this.tasks).forEach(workDateKey => {
        // Skip dates outside the loaded range
        if (workDateKey < rangeStartString || workDateKey > rangeEndString) {
            return;
        }
        
        const peopleToCheck = selectedPerson === 'all' ? Object.keys(this.tasks[workDateKey]) : [selectedPerson];
        
        peopleToCheck.forEach(person => {
            if (this.tasks[workDateKey][person]) {
                this.tasks[workDateKey][person].forEach(task => {
                    if (task.completed) return; // Skip completed orders
                    
                    let dueDateString;
                    if (task.dateDue instanceof Date) {
                        dueDateString = task.dateDue.toISOString().split('T')[0];
                    } else if (typeof task.dateDue === 'string') {
                        dueDateString = task.dateDue.includes('T') ? task.dateDue.split('T')[0] : task.dateDue;
                    } else {
                        return;
                    }
                    
                    // Only include if due before today
                    if (dueDateString < todayString) {
                        filteredData.push({
                            task,
                            person,
                            workDate: workDateKey,
                            workDateDisplay: this.formatDateForDisplay(workDateKey),
                            dueDateDisplay: this.formatDateForDisplay(task.dateDue),
                            durationDisplay: `${task.duration * 15} min`,
                            isOverdue: true,
                            status: '⚠️ Overdue',
                            statusClass: 'text-red-600'
                        });
                    }
                });
            }
        });
    });
}                
                this.displayReport(filteredData, selectedPerson, startDate, endDate, statusFilter);
            }
            
collectReportData(selectedPerson, startDate, endDate) {
    const reportData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    Object.keys(this.tasks).forEach(workDateKey => {
        const peopleToCheck = selectedPerson === 'all' ? Object.keys(this.tasks[workDateKey]) : [selectedPerson];
        
        peopleToCheck.forEach(person => {
            if (this.tasks[workDateKey][person]) {
                this.tasks[workDateKey][person].forEach(task => {
                    const taskDueDateString = this.getTaskDueDateString(task.dateDue);
                    
                    if (taskDueDateString >= startDate && taskDueDateString <= endDate) {
                        let status, statusClass;
                        
                        // Parse due date properly for comparison
// FIXED CODE:
const taskDueDate = task.dateDue ? this.parseDateString(task.dateDue) : null;
if (taskDueDate) {
    taskDueDate.setHours(0, 0, 0, 0); // Normalize to start of day
}

if (task.completed) {
    status = '✅ Complete';
    statusClass = 'text-green-600';
} else if (taskDueDate && taskDueDate < today) {
    status = '⚠️ Overdue';
    statusClass = 'text-red-600';
} else {
    status = 'Incomplete';
    statusClass = 'text-blue-600';
}
                                    
                                    reportData.push({
                                        task,
                                        person,
                                        workDate: workDateKey,
                                        workDateDisplay: this.formatDateForDisplay(workDateKey),
                                        dueDateDisplay: this.formatDateForDisplay(task.dateDue),
                                        durationDisplay: `${task.duration * 15} min`,
                                        isOverdue: !task.completed && taskDueDateString && taskDueDateString !== '9999-12-31' && taskDueDateString < today.toISOString().split('T')[0],
                                        status,
                                        statusClass
                                    });
                                }
                            });
                        }
                    });
                });

                return reportData.sort((a, b) => a.task.dateDue - b.task.dateDue);
            }
            
            getTaskDueDateString(dateDue) {
                if (dateDue instanceof Date) {
                    return dateDue.toISOString().split('T')[0];
                } else if (typeof dateDue === 'string') {
                    return dateDue.includes('T') ? dateDue.split('T')[0] : dateDue;
                }
                return '9999-12-31';
            }
            
            displayReport(reportData, selectedPerson, startDate, endDate, filterType) {
                const resultsContainer = document.getElementById('reportResults');
                
                if (reportData.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="text-center py-8 text-gray-500 ">
                            <p class="text-lg font-medium">No orders found</p>
                        </div>
                    `;
                    document.getElementById('exportReport').classList.add('hidden');
                    return;
                }

const totalOrders = reportData.length;
const incompleteOrders = reportData.filter(item => !item.task.completed).length;
// Calculate overdue directly: incomplete orders that are past due date
const today = new Date();
today.setHours(0, 0, 0, 0);
const overdueOrders = reportData.filter(item => {
    if (item.task.completed) return false; // Skip completed orders
    
    // Get due date string
    let dueDateString;
    if (item.task.dateDue instanceof Date) {
        dueDateString = item.task.dateDue.toISOString().split('T')[0];
    } else if (typeof item.task.dateDue === 'string') {
        dueDateString = item.task.dateDue.includes('T') ? item.task.dateDue.split('T')[0] : item.task.dateDue;
    } else {
        return false;
    }
    
    const todayString = today.toISOString().split('T')[0];
    return dueDateString < todayString; // Due before today
}).length;
const totalDuration = reportData.reduce((sum, item) => sum + item.task.duration, 0);
const totalHours = Math.floor(totalDuration * 15 / 60);
const totalMins = (totalDuration * 15) % 60;

const summaryDiv = document.createElement('div');
summaryDiv.className = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6';
summaryDiv.innerHTML = `
    <h4 class="font-semibold text-blue-800 mb-4">📊 Report Summary</h4>
    <div class="grid grid-cols-4 gap-4 text-sm">
        <div class="text-center">
            <button class="report-filter-btn hover:bg-blue-100 p-2 rounded transition-colors w-full" data-filter="all">
                <div class="text-2xl font-bold text-blue-600">${totalOrders}</div>
                <div class="text-blue-700">Total Orders</div>
            </button>
        </div>
        <div class="text-center">
            <button class="report-filter-btn hover:bg-yellow-100 p-2 rounded transition-colors w-full" data-filter="incomplete">
                <div class="text-2xl font-bold ${incompleteOrders > 0 ? 'text-yellow-600' : 'text-green-600 '}">${incompleteOrders}</div>
                <div class="text-blue-700">Incomplete</div>
            </button>
        </div>
        <div class="text-center">
            <button class="report-filter-btn hover:bg-red-100 p-2 rounded transition-colors w-full" data-filter="overdue">
                <div class="text-2xl font-bold ${overdueOrders > 0 ? 'text-red-600' : 'text-green-600'}">${overdueOrders}</div>
                <div class="text-blue-700">Overdue</div>
            </button>
        </div>
        <div class="text-center">
            <div class="p-2">
                <div class="text-2xl font-bold text-blue-600">${totalHours}h ${totalMins}m</div>
                <div class="text-blue-700">Total Time</div>
            </div>
        </div>
    </div>
    <div class="mt-3 text-sm text-blue-700">
        <strong>Period:</strong> ${this.formatDateForDisplay(startDate)} - ${this.formatDateForDisplay(endDate)}
        ${selectedPerson !== 'all' ? ` • <strong>Person:</strong> ${selectedPerson}` : ''}
        • <strong>Filter:</strong> ${filterType === 'incomplete' ? 'Incomplete Orders Only' : filterType === 'overdue' ? 'Overdue Orders Only' : filterType === 'completed' ? 'Completed Orders Only' : 'All Orders'}
    </div>
                `;
// Add click handlers for the filter buttons
resultsContainer.appendChild(summaryDiv);

summaryDiv.querySelectorAll('.report-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        this.generateReport(filter);
    });
});

resultsContainer.innerHTML = '';
resultsContainer.appendChild(summaryDiv);

                const tableContainer = document.createElement('div');
                tableContainer.className = 'overflow-x-auto bg-white rounded-lg border border-gray-200';
                
                const table = document.createElement('table');
                table.className = 'min-w-full divide-y divide-gray-200';
                
                table.innerHTML = `
                    <thead class="bg-gray-50 ">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Order #</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Person</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Description</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Work Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Due Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Duration</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    </tbody>
                `;

                const tbody = table.querySelector('tbody');
                
                reportData.forEach((item, index) => {
                    const row = document.createElement('tr');
                    row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50 ';
                    
                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">#${item.task.orderNumber}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">${item.person}</td>
                        <td class="px-6 py-4 text-sm text-gray-900  max-w-xs truncate" title="${item.task.description}">${item.task.description}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">${item.workDateDisplay}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">${item.dueDateDisplay}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">${item.durationDisplay}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <span class="flex items-center cursor-pointer">
                                <input type="checkbox" class="report-checkbox w-4 h-4 text-primary border border-gray-300 rounded focus:ring-2 focus:ring-primary mr-2" 
                                       data-task-id="${item.task.id}" 
                                       data-person="${item.person}" 
                                       data-date="${item.workDate}"
                                       ${item.task.completed ? 'checked' : ''}>
                                <span class="font-medium ${item.statusClass}">${item.status}</span>
                            </span>
                        </td>
                    `;
                    
                    row.addEventListener('dblclick', () => {
                        this.handleModalAction('reportsModal', 'hide');
                        
                        const [year, month, day] = item.workDate.split('-');
                        this.currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        this.updateDateDisplay();
                        this.renderWhiteboard();
                        
                        setTimeout(() => this.highlightOrder(item.task.orderNumber, item.person), 200);
                    });
                    row.style.cursor = 'pointer';
                    row.title = 'Double-click to navigate';
                    
                    tbody.appendChild(row);
                });

                // Add event listeners to checkboxes in the report
                const checkboxes = tbody.querySelectorAll('.report-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', async (e) => {
                        e.stopPropagation();
                        
                        const taskId = checkbox.dataset.taskId;
                        const person = checkbox.dataset.person;
                        const dateKey = checkbox.dataset.date;
                        
                        // Find the task and toggle its completion
                        let foundTask = null;
                        if (this.tasks[dateKey] && this.tasks[dateKey][person]) {
                            foundTask = this.tasks[dateKey][person].find(t => t.id == taskId);
                            if (foundTask) {
                                await this.toggleTaskCompletion(foundTask);
                                
                                // Refresh the report to show updated status
                                this.generateReport(filterType);
                            }
                        }
                    });
                });

                tableContainer.appendChild(table);
                
                resultsContainer.innerHTML = '';
                resultsContainer.appendChild(summaryDiv);
                resultsContainer.appendChild(tableContainer);

                document.getElementById('exportReport').classList.remove('hidden');
                this.currentReportData = reportData;
            }
            
            exportReport() {
                if (!this.currentReportData || this.currentReportData.length === 0) {
                    this.showErrorToast('validation', 'No report data to export');
                    return;
                }

                const csvHeader = 'Order Number,Person,Description,Work Date,Due Date,Duration (min),Status\n';
                const csvRows = this.currentReportData.map(item => {
                    let statusText;
                    if (item.task.completed) {
                        statusText = 'Complete';
                    } else if (item.isOverdue) {
                        statusText = 'Overdue';
                    } else {
                        statusText = 'Incomplete';
                    }
                    
                    // Escape description for CSV (handle commas and quotes)
                    const description = item.task.description.replace(/"/g, '""');
                    const descriptionFormatted = description.includes(',') ? `"${description}"` : description;
                    
                    return [
                        item.task.orderNumber,
                        item.person,
                        descriptionFormatted,
                        item.workDateDisplay,
                        item.dueDateDisplay,
                        item.task.duration * 15,
                        statusText
                    ].join(',');
                }).join('\n');

                const csvContent = csvHeader + csvRows;
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `ready-date-report-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showSuccessToast('save', 'Report');
            }
//Export Thermal Report
exportThermalReport() {
    if (!this.currentReportData || this.currentReportData.length === 0) {
        this.showToast('No data to export', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    
    let content = '';
    content += '==========================\n';
    content += '     TASK REPORT\n';
    content += '==========================\n';
    content += 'Date: ' + new Date().toLocaleDateString() + '\n';
    content += 'Total: ' + this.currentReportData.length + ' orders\n';
    content += '==========================\n\n';
    
    this.currentReportData.forEach((item, index) => {
        content += 'ORDER ' + (index + 1) + '\n';
        content += 'Number: ' + item.task.orderNumber + '\n';
        content += 'Person: ' + item.person + '\n';
        content += 'Work: ' + item.workDateDisplay + '\n';
        content += 'Due: ' + item.dueDateDisplay + '\n';
        content += 'Time: ' + (item.task.duration * 15) + ' min\n';
        content += 'Status: ' + (item.task.completed ? 'DONE' : 'PENDING') + '\n';
        content += 'Notes: ' + item.task.description + '\n';
        content += '==========================\n\n';
    });
    
    const html = '<html><body style="font-family: monospace; white-space: pre; font-size: 12px; padding: 10px;">' + content + '</body></html>';
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    
    this.showToast('Report sent to thermal printer', 'success');
}

//Show Export Options            
showExportOptionsModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold mb-4">📤 Export Report</h3>
            <p class="text-sm text-gray-600  mb-4">Choose your export format:</p>
            
            <div class="space-y-3">
                <button id="exportCSV" class="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                    <div class="font-medium text-blue-800">💾 CSV File</div>
                    <div class="text-xs text-blue-600">Standard spreadsheet format</div>
                </button>
                
                <button id="exportThermal" class="w-full p-3 text-left bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors">
                    <div class="font-medium text-orange-800">🖨️ Thermal Printer</div>
                    <div class="text-xs text-orange-600">Optimized for thermal receipt printers</div>
                </button>
            </div>
            
            <div class="flex justify-end space-x-3 mt-6">
                <button id="cancelExport" class="px-4 py-2 text-gray-600  hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#exportCSV').addEventListener('click', () => {
        document.body.removeChild(modal);
        this.exportReport();
    });
    
    modal.querySelector('#exportThermal').addEventListener('click', () => {
        document.body.removeChild(modal);
        this.exportThermalReport();
    });
    
    modal.querySelector('#cancelExport').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}


            
            // Share Modal Functions
            showShareModal() {
                const baseUrl = window.location.origin + window.location.pathname;
                const shareUrl = this.airtableConfig.baseId ? 
                    `${baseUrl}?baseId=${this.airtableConfig.baseId}` : 
                    baseUrl;
                
                document.getElementById('shareLink').value = shareUrl;
                document.getElementById('shareModal').classList.remove('hidden');
                
                document.getElementById('copyShareLink').addEventListener('click', () => {
                    const shareLink = document.getElementById('shareLink');
                    shareLink.select();
                    navigator.clipboard.writeText(shareLink.value).then(() => {
                        this.showSuccessToast('copy', 'Link');
                    });
                });
            }
            
            // Mini Calendar & Keyboard Shortcuts
            showMiniCalendar() {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
                const currentMonth = this.currentDate.getMonth();
                const currentYear = this.currentDate.getFullYear();
                const today = new Date();
                
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                
                const firstDay = new Date(currentYear, currentMonth, 1);
                const lastDay = new Date(currentYear, currentMonth + 1, 0);
                const startingDayOfWeek = firstDay.getDay();
                const daysInMonth = lastDay.getDate();
                
                // Create calendar grid
                let calendarHTML = '';
                let dayCounter = 1;
                
                // Week header
                const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                calendarHTML += '<div class="grid grid-cols-7 gap-1 mb-2">';
                weekDays.forEach(day => {
                    calendarHTML += `<div class="p-2 text-center text-sm font-medium text-gray-500 ">${day}</div>`;
                });
                calendarHTML += '</div>';
                
                // Calendar days
                for (let week = 0; week < 6; week++) {
                    calendarHTML += '<div class="grid grid-cols-7 gap-1">';
                    
                    for (let day = 0; day < 7; day++) {
                        const dayNumber = dayCounter - startingDayOfWeek;
                        
                        if (dayNumber <= 0 || dayNumber > daysInMonth) {
                            calendarHTML += '<div class="p-2 h-10"></div>';
                        } else {
                            const isToday = currentYear === today.getFullYear() && 
                                          currentMonth === today.getMonth() && 
                                          dayNumber === today.getDate();
                                          
                            const isSelected = currentYear === this.currentDate.getFullYear() && 
                                             currentMonth === this.currentDate.getMonth() && 
                                             dayNumber === this.currentDate.getDate();
                            
                            const cellClass = isSelected ? 
                                'bg-primary text-white' : 
                                isToday ? 
                                    'bg-blue-100 text-blue-800' : 
                                    'hover:bg-gray-100';
                            
                            calendarHTML += `
                                <button class="calendar-day p-2 h-10 text-sm rounded transition-colors ${cellClass}" 
                                        data-day="${dayNumber}">
                                    ${dayNumber}
                                </button>
                            `;
                        }
                        
                        dayCounter++;
                    }
                    
                    calendarHTML += '</div>';
                    
                    if (dayCounter > daysInMonth + startingDayOfWeek) break;
                }
                
                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 fade-in">
                        <div class="flex items-center justify-between mb-4">
                            <button class="prev-month p-2 hover:bg-gray-100 rounded transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                                </svg>
                            </button>
                            <h3 class="text-lg font-semibold">${monthNames[currentMonth]} ${currentYear}</h3>
                            <button class="next-month p-2 hover:bg-gray-100 rounded transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="calendar-grid">
                            ${calendarHTML}
                        </div>
                        
                        <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 ">
                            <button class="today-btn px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Today</button>
                            <button class="close-calendar px-3 py-2 text-sm text-gray-600  hover:bg-gray-100 rounded transition-colors">Close</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Event listeners
                modal.querySelector('.close-calendar').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('.today-btn').addEventListener('click', () => {
                    this.currentDate = new Date();
                    this.updateDateDisplay();
                    this.renderWhiteboard();
                    document.body.removeChild(modal);
                    this.showToast('Navigated to today', 'success');
                });
                
                modal.querySelectorAll('.calendar-day').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const day = parseInt(btn.dataset.day);
                        this.currentDate = new Date(currentYear, currentMonth, day);
                        this.updateDateDisplay();
                        this.renderWhiteboard();
                        document.body.removeChild(modal);
                        this.showToast(`Navigated to ${this.currentDate.toLocaleDateString()}`, 'success');
                    });
                });
                
                // Close on outside click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });
            }
            
            showKeyboardShortcuts() {
                const modal = this.createModal('⌨️ Keyboard Shortcuts', `
                    <div class="space-y-4 text-sm">
                        <div class="grid grid-cols-2 gap-6">
                            <div>
                                <h4 class="font-semibold mb-3 text-primary">Navigation</h4>
                                <ul class="space-y-2">
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">T</kbd> Go to Today</li>
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">←</kbd> Previous Day</li>
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">→</kbd> Next Day</li>
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">1/2/3</kbd> Switch View</li>
                                </ul>
                            </div>
                            <div>
                                <h4 class="font-semibold mb-3 text-primary">Actions</h4>
                                <ul class="space-y-2">
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">Ctrl+N</kbd> New Order</li>
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">Ctrl+F</kbd> Search</li>
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">Ctrl+R</kbd> Reports</li>
                                    <li><kbd class="px-2 py-1 bg-gray-100  rounded text-xs">Ctrl+Shift+S</kbd> Settings</li>
                                </ul>
                            </div>
                        </div>
                        <div class="pt-3 border-t border-gray-200 ">
                            <p class="text-xs text-gray-500 ">
                                Press <kbd class="px-1 py-0.5 bg-gray-100  rounded text-xs">?</kbd> or 
                                <kbd class="px-1 py-0.5 bg-gray-100  rounded text-xs">H</kbd> anytime to show this help
                            </p>
                        </div>
                    </div>
                `, { maxWidth: 'max-w-2xl' });
            }
            
            showKeyboardShortcutsToast() {
                setTimeout(() => {
                    this.showToast('💡 Press ? or H for keyboard shortcuts', 'info');
                }, 2000);
            }
            
            // Keyboard shortcut handlers
            goToToday() {
                this.currentDate = new Date();
                this.updateDateDisplay();
                this.renderWhiteboard();
                this.showToast('Navigated to today', 'success');
            }
            
            navigateDay(direction) {
                const newDate = new Date(this.currentDate);
                newDate.setDate(newDate.getDate() + direction);
                this.currentDate = newDate;
                this.updateDateDisplay();
                this.renderWhiteboard();
                const dayName = direction > 0 ? 'Next day' : 'Previous day';
                this.showToast(`${dayName}: ${this.currentDate.toLocaleDateString()}`, 'info');
            }
            
            setViewDays(days) {
                this.viewDays = days;
                document.getElementById('viewDaysSelect').value = days.toString();
                this.updateDateDisplay();
                this.renderWhiteboard();
                this.showToast(`View: ${days} day${days !== 1 ? 's' : ''}`, 'success');
                this.saveViewPreferences();
            }
            
            // Date Picker
            showDatePicker() {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4 fade-in">
                        <h3 class="text-lg font-semibold mb-4">📅 Go to Date</h3>
                        <div class="space-y-4">
                            <div>
                                <span class="block text-sm font-medium mb-2">Select Date:</span>
                                <input type="date" id="datePickerInput" value="${this.dateToLocalDateString(this.currentDate)}" class="w-full p-3 text-base border border-gray-300  rounded-lg bg-white  focus:ring-2 focus:ring-primary focus:border-transparent">
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3 mt-6">
                            <button class="cancel-date-picker px-4 py-2 text-gray-600  hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            <button class="confirm-date-picker px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors">Go to Date</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                const input = modal.querySelector('#datePickerInput');
                input.focus();

                modal.querySelector('.cancel-date-picker').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });

                modal.querySelector('.confirm-date-picker').addEventListener('click', () => {
                    const selectedDate = input.value;
                    if (selectedDate) {
                        const [year, month, day] = selectedDate.split('-');
                        this.currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        this.updateDateDisplay();
                        this.renderWhiteboard();
                        this.showToast('Navigated to ' + this.currentDate.toLocaleDateString(), 'success');
                    }
                    document.body.removeChild(modal);
                });

                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        modal.querySelector('.confirm-date-picker').click();
                    }
                });
            }
            
            // Utility Functions
            createModal(title, content, options = {}) {
                const {
                    maxWidth = 'max-w-lg',
                    showCloseButton = true,
                    className = ''
                } = options;

                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
                const closeButtonHTML = showCloseButton ? `
                    <button class="modal-close absolute top-4 right-4 text-gray-400 hover:text-gray-600  p-1 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                ` : '';

                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl ${maxWidth} w-full mx-4 relative max-h-[90vh] overflow-y-auto fade-in ${className}">
                        ${closeButtonHTML}
                        <h3 class="text-lg font-semibold mb-6">${title}</h3>
                        ${content}
                    </div>
                `;

                document.body.appendChild(modal);

                if (showCloseButton) {
                    modal.querySelector('.modal-close').addEventListener('click', () => {
                        this.closeModal(modal);
                    });
                }

                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(modal);
                    }
                });

                return modal;
            }

            createConfirmationModal(title, message, onConfirm, confirmText = 'Confirm', confirmClass = 'bg-red-500 hover:bg-red-600') {
                const content = `
                    <div class="text-gray-700  mb-6">${message}</div>
                    <div class="flex justify-end space-x-3">
                        <button class="cancel-btn px-4 py-2 text-gray-600  hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                        <button class="confirm-btn px-4 py-2 text-white rounded-lg transition-colors ${confirmClass}">${confirmText}</button>
                    </div>
                `;

                const modal = this.createModal(title, content, { maxWidth: 'max-w-sm', showCloseButton: false });

                modal.querySelector('.cancel-btn').addEventListener('click', () => {
                    this.closeModal(modal);
                });

                modal.querySelector('.confirm-btn').addEventListener('click', async () => {
                    this.closeModal(modal);
                    await onConfirm();
                });

                return modal;
            }

            closeModal(modal) {
                if (modal && modal.parentNode) {
                    document.body.removeChild(modal);
                }
            }

            populatePeopleDropdown(selectId, includeAllOption = false) {
                const select = document.getElementById(selectId);
                if (!select) return;
                
                select.innerHTML = includeAllOption ? '<option value="all">All People</option>' : '';
                
                this.people.forEach(person => {
                    const option = document.createElement('option');
                    option.value = person;
                    option.textContent = person;
                    select.appendChild(option);
                });
            }

            showDeleteConfirmation(task) {
                const message = `
                    <p class="mb-4">Are you sure you want to delete order <strong>#${task.orderNumber}</strong>?</p>
                    <p class="text-sm text-gray-500 ">${task.description}</p>
                `;
                this.createConfirmationModal('🗑️ Delete Order', message, () => this.deleteTask(task), 'Delete');
            }
            
            showRemovePersonConfirmation(person) {
                if (this.people.length <= 1) {
                    this.showErrorToast('validation', 'Cannot remove the last person');
                    return;
                }
                
                const message = `
                    <p class="mb-4">Remove <strong>${person}</strong> from the active schedule?</p>
                    <p class="text-sm text-gray-500 ">This will hide them from the current view but keep all their data intact.</p>
                `;
                this.createConfirmationModal('👤 Remove Person', message, () => this.deactivatePerson(person), 'Remove', 'bg-orange-500 hover:bg-orange-600');
            }
            
            showCapacityModal(person) {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
                let currentCapacity = this.peopleCapacity[person];
                if (!currentCapacity || typeof currentCapacity !== 'object') {
                    currentCapacity = {};
                    this.DAYS_OF_WEEK.forEach(day => {
                        currentCapacity[day] = 16;
                    });
                }
                
                const capacityInputs = this.DAYS_OF_WEEK.map(day => {
                    const value = currentCapacity[day] || 16;
                    return `
                        <div>
                            <span class="block text-sm font-medium mb-1">${day}:</span>
                            <input type="number" id="capacity${day}" min="0" max="32" value="${value}" 
                                   class="w-full p-2 text-base border border-gray-300  rounded-lg bg-white  focus:ring-2 focus:ring-primary focus:border-transparent">
                        </div>
                    `;
                }).join('');
                
                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4 fade-in">
                        <h3 class="text-lg font-semibold mb-4">⏰ Edit Capacity for ${person}</h3>
                        <div class="space-y-4">
                            <div>
                                <span class="block text-sm font-medium mb-3">Daily Capacity (15-min slots):</span>
                                <div class="grid grid-cols-2 gap-3">
                                    ${capacityInputs}
                                </div>
                                <p class="text-xs text-gray-500  mt-2">Each slot = 15 minutes. 32 slots = 8 hours max.</p>
                            </div>
                            
                            <div class="bg-gray-50  p-3 rounded-lg">
                                <span class="block text-sm font-medium mb-2">Quick Presets:</span>
                                <div class="flex flex-wrap gap-2">
                                    <button type="button" class="preset-full-time px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors">Full Time (Mon-Fri, 8h)</button>
                                    <button type="button" class="preset-part-time px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Part Time (Mon-Fri, 4h)</button>
                                    <button type="button" class="preset-weekends px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors">Weekends Only</button>
                                    <button type="button" class="preset-clear px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Clear All</button>
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3 mt-6">
                            <button class="cancel-capacity px-4 py-2 text-gray-600  hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            <button class="save-capacity px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors">Save</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                const cancelButton = modal.querySelector('.cancel-capacity');
                const saveButton = modal.querySelector('.save-capacity');
                
                modal.querySelector('.preset-full-time').addEventListener('click', () => {
                    this.DAYS_OF_WEEK.forEach(day => {
                        const input = modal.querySelector(`#capacity${day}`);
                        if (input) {
                            input.value = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day) ? '32' : '0';
                        }
                    });
                });
                
                modal.querySelector('.preset-part-time').addEventListener('click', () => {
                    this.DAYS_OF_WEEK.forEach(day => {
                        const input = modal.querySelector(`#capacity${day}`);
                        if (input) {
                            input.value = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day) ? '16' : '0';
                        }
                    });
                });
                
                modal.querySelector('.preset-weekends').addEventListener('click', () => {
                    this.DAYS_OF_WEEK.forEach(day => {
                        const input = modal.querySelector(`#capacity${day}`);
                        if (input) {
                            input.value = ['Saturday', 'Sunday'].includes(day) ? '32' : '0';
                        }
                    });
                });
                
                modal.querySelector('.preset-clear').addEventListener('click', () => {
                    this.DAYS_OF_WEEK.forEach(day => {
                        const input = modal.querySelector(`#capacity${day}`);
                        if (input) {
                            input.value = '0';
                        }
                    });
                });
                
                cancelButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeModal(modal);
                });

                saveButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const weeklyCapacity = {};
                    this.DAYS_OF_WEEK.forEach(day => {
                        const input = modal.querySelector(`#capacity${day}`);
                        const capacity = parseInt(input.value) || 0;
                        weeklyCapacity[day] = Math.max(0, Math.min(capacity, 32));
                    });
                    
                    // 🚨 CRITICAL FIX: ALWAYS preserve historical capacity BEFORE making ANY changes
                    if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                        this.showLoading('Preserving historical data and updating capacity...');
                        try {
                            // Step 1: Preserve historical capacity FIRST
                            console.log(`🔒 FORCING historical preservation for ${person} before weekly capacity update`);
                            await this.preserveHistoricalCapacity(person);
                            
                            // Step 2: Update weekly capacity in Airtable
                            await this.updatePersonWeeklyCapacityInAirtable(person, weeklyCapacity);
                            
                            // Step 3: Update local state only AFTER successful Airtable update
                            this.peopleCapacity[person] = weeklyCapacity;
                            await this.savePeopleCapacityToLocal();
                            
                            this.showToast('✅ Capacity updated with historical data preserved!', 'success');
                        } catch (error) {
                            console.error('❌ Failed to update capacity with preservation:', error);
                            this.showToast(`❌ Failed to update capacity: ${error.message}`, 'error');
                            return; // Don't close modal on error
                        } finally {
                            this.hideLoading();
                        }
                    } else {
                        // No Airtable connection - just update locally
                        this.peopleCapacity[person] = weeklyCapacity;
                        try {
                            await this.savePeopleCapacityToLocal();
                            this.showToast('Capacity updated locally! Connect to Airtable to preserve historical data.', 'info');
                        } catch (error) {
                            console.warn('Could not save to local storage:', error);
                            this.showToast('Capacity updated successfully!', 'success');
                        }
                    }
                    
                    this.closeModal(modal);
                    this.renderWhiteboard();
                    this.updateCurrentPeopleList();
                });
            }
            
            showTaskDetails(task) {
                let currentPerson = null;
                let currentDateKey = null;
                
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const foundTask = this.tasks[dateKey][person].find(t => t.id === task.id);
                        if (foundTask) {
                            currentPerson = person;
                            currentDateKey = dateKey;
                            break;
                        }
                    }
                    if (currentPerson) break;
                }
                
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
const formattedDueDate = task.dateDue ? this.formatDateForDisplay(task.dateDue) : 'No Due Date';

// Format work date with day of week
let formattedWorkDate;
const workDate = this.parseDateString(currentDateKey);
if (workDate) {
    const dateStr = workDate.toLocaleDateString();
    const dayName = this.DAYS_OF_WEEK[workDate.getDay()].substring(0, 3);
    formattedWorkDate = `${dateStr} ${dayName}`;
} else {
    formattedWorkDate = this.formatDateForDisplay(currentDateKey);
}
                // Fix overdue calculation - normalize dates to avoid time issues
const today = new Date();
today.setHours(0, 0, 0, 0);
const taskDueDate = task.dateDue ? this.parseDateString(task.dateDue) : null;
if (taskDueDate) {
    taskDueDate.setHours(0, 0, 0, 0);
}
const isOverdue = !task.completed && taskDueDate && taskDueDate < today;

                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto fade-in">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xl font-bold text-primary">📋 Order Details</h3>
                            <button class="close-details text-gray-400 hover:text-gray-600  p-1 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <span class="block text-sm font-medium text-gray-700  mb-1">Order Number:</span>
                                    <div class="text-lg font-semibold text-primary">#${task.orderNumber}</div>
                                </div>
                                <div>
                                    <span class="block text-sm font-medium text-gray-700  mb-1">Duration:</span>
                                    <div class="text-lg font-semibold">${task.duration * 15} minutes</div>
                                </div>
                            </div>
                            
                            <div>
                                <span class="block text-sm font-medium text-gray-700  mb-1">Assigned to:</span>
                                <div class="text-lg font-semibold text-blue-600">${currentPerson || 'Unknown'}</div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <span class="block text-sm font-medium text-gray-700  mb-1">Work Date:</span>
                                    <div class="text-sm">${formattedWorkDate}</div>
                                </div>
                                <div>
                                    <span class="block text-sm font-medium text-gray-700  mb-1">Due Date:</span>
                                    <div class="text-sm ${isOverdue ? 'text-red-600' : 'text-green-600'}">${formattedDueDate}</div>
                                </div>
                            </div>
                            
                            <div>
                                <span class="block text-sm font-medium text-gray-700  mb-2">Description:</span>
                                <div class="bg-gray-50  p-3 rounded-lg border">
                                    <p class="text-gray-800 leading-relaxed">${task.description || 'No description provided'}</p>
                                </div>
                            </div>

                            <div class="bg-gray-50  p-4 rounded-lg border">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <span class="block text-sm font-medium text-gray-700  mb-1">Status:</span>
                                        <div class="text-sm ${task.completed ? 'text-green-600' : 'text-yellow-600'}">
                                            ${task.completed ? '✅ Completed' : '⏳ In Progress'}
                                        </div>
                                    </div>
                                    <button class="toggle-status-btn px-4 py-2 rounded-lg font-medium transition-colors ${task.completed ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-green-500 text-white hover:bg-green-600'}">
                                        ${task.completed ? 'Mark Incomplete' : 'Mark Complete'}
                                    </button>
                                </div>
                            </div>
                            
                            ${isOverdue ? 
                                '<div class="bg-red-50 border border-red-200 rounded-lg p-3"><p class="text-red-800 text-sm font-medium">⚠️ This order is overdue</p></div>' : 
                                ''
                            }
                        </div>
                        
                        <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 ">
                            <button class="edit-task-btn px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors">
                                Edit Order
                            </button>
                            <button class="close-details px-4 py-2 text-gray-600  hover:bg-gray-100 rounded-lg transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                modal.querySelectorAll('.close-details').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });
                });

                modal.querySelector('.edit-task-btn').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    this.editTask(task);
                });

                modal.querySelector('.toggle-status-btn').addEventListener('click', async () => {
                    await this.toggleTaskCompletion(task);
                    document.body.removeChild(modal);
                });
            }
            
            // Quick Capacity Modal for specific days
            showQuickCapacityModal(person, dateKey) {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
                const date = this.parseDateString(dateKey);
                const currentCapacity = this.getPersonCapacityForDate(person, date);
                const dayName = this.DAYS_OF_WEEK[date.getDay()];
                const formattedDate = this.formatDateForDisplay(dateKey);
                
                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4 fade-in">
                        <h3 class="text-lg font-semibold mb-4">⚡ Quick Capacity Override</h3>
                        <div class="space-y-4">
                            <div class="bg-gray-50  p-3 rounded-lg">
                                <div class="text-sm text-gray-600 ">Person:</div>
                                <div class="font-medium">${person}</div>
                            </div>
                            <div class="bg-gray-50  p-3 rounded-lg">
                                <div class="text-sm text-gray-600 ">Date:</div>
                                <div class="font-medium">${formattedDate} (${dayName})</div>
                            </div>
                            <div>
                                <span class="block text-sm font-medium mb-2">
                                    Capacity for this day (15-min slots):
                                </span>
                                <input type="number" id="quickCapacityInput" min="0" max="32" value="${currentCapacity}" 
                                       class="w-full p-3 text-base border border-gray-300  rounded-lg bg-white  focus:ring-2 focus:ring-primary focus:border-transparent">
                                <div class="text-xs text-gray-500  mt-1">
                                    Current: ${currentCapacity} slots (${Math.floor(currentCapacity * 15 / 60)}h ${(currentCapacity * 15) % 60}m)
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button id="quickAbsent" class="px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Absent (0)</button>
                                <button id="quickHalfDay" class="px-3 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">Half Day (16)</button>
                                <button id="quickFullDay" class="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors">Full Day (32)</button>
                                <button id="quickAllOpen" class="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">All open slots</button>
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3 mt-6">
                            <button class="cancel-quick-capacity px-4 py-2 text-gray-600  hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            <button class="save-quick-capacity px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors">Save</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                const capacityInput = modal.querySelector('#quickCapacityInput');
                capacityInput.focus();
                capacityInput.select();

                modal.querySelector('#quickAbsent').addEventListener('click', () => {
                    capacityInput.value = '0';
                });

                modal.querySelector('#quickHalfDay').addEventListener('click', () => {
                    capacityInput.value = '16';
                });

                modal.querySelector('#quickFullDay').addEventListener('click', () => {
                    capacityInput.value = '32';
                });

                modal.querySelector('#quickAllOpen').addEventListener('click', () => {
                    const personTasks = this.tasks[dateKey]?.[person] || [];
                    const usedSlots = personTasks.reduce((total, task) => total + task.duration, 0);
                    capacityInput.value = usedSlots.toString();
                });

                modal.querySelector('.cancel-quick-capacity').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });

                modal.querySelector('.save-quick-capacity').addEventListener('click', async () => {
                    const newCapacity = parseInt(capacityInput.value) || 0;
                    const clampedCapacity = Math.max(0, Math.min(newCapacity, 32));
                    
                    await this.addCapacityOverride(person, dateKey, '', clampedCapacity);
                    
                    document.body.removeChild(modal);
                });

                capacityInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        modal.querySelector('.save-quick-capacity').click();
                    }
                });
            }
            
            // Snap Cards Functionality
            snapCardsToTop(person, dateKey) {
                if (!dateKey) {
                    dateKey = this.dateToLocalDateString(this.currentDate);
                }
                const personTasks = this.tasks[dateKey]?.[person] || [];
                
                if (personTasks.length === 0) {
                    this.showToast('No cards to snap for this person', 'info');
                    return;
                }
                
                const sortedTasks = [...personTasks].sort((a, b) => a.position - b.position);
                
                let currentPosition = 0;
                
                sortedTasks.forEach(task => {
                    task.position = currentPosition;
                    currentPosition += task.duration;
                });
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Snapping cards...');
                    
                    const updatePromises = sortedTasks.map(task => 
                        this.updateTaskInAirtable(task.id, { Position: task.position })
                    );
                    
                    Promise.all(updatePromises)
                        .then(() => {
                            this.showToast(`${sortedTasks.length} cards snapped to top for ${person}`, 'success');
                        })
                        .catch((error) => {
                            this.showToast(`Cards snapped locally. Sync failed: ${error.message}`, 'warning');
                        })
                        .finally(() => {
                            this.hideLoading();
                        });
                } else {
                    this.showToast(`${sortedTasks.length} cards snapped to top for ${person}`, 'success');
                }
                
                this.renderWhiteboard();
            }

            // Capacity Overrides Modal
            showCapacityOverridesModal(person) {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
                const currentOverrides = this.peopleSpecificCapacity[person] || {};
                const sortedDates = Object.keys(currentOverrides).sort();
                
                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto fade-in">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-lg font-semibold">📅 Capacity Overrides for ${person}</h3>
                            <button class="close-overrides text-gray-400 hover:text-gray-600 p-1 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <!-- Add New Override Section -->
                        <div class="bg-gray-50 p-4 rounded-lg mb-6">
                            <h4 class="font-medium mb-4">Add New Override</h4>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <span class="block text-sm font-medium mb-2">Start Date:</span>
                                    <input type="date" id="overrideStartDate" class="w-full p-3 text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                                </div>
                                <div>
                                    <span class="block text-sm font-medium mb-2">End Date (Optional):</span>
                                    <input type="date" id="overrideEndDate" class="w-full p-3 text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                                </div>
                                <div>
                                    <span class="block text-sm font-medium mb-2">Capacity (slots):</span>
                                    <input type="number" id="overrideCapacity" min="0" max="32" value="0" class="w-full p-3 text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                                </div>
                            </div>
                            <div class="flex justify-between items-center">
                                <div class="flex space-x-2">
                                    <button id="quickAbsentToday" class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Absent Today</button>
                                    <button id="quickAbsentTomorrow" class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Absent Tomorrow</button>
                                    <button id="quickAbsentWeekend" class="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors">Absent This Weekend</button>
                                </div>
                                <button id="addOverride" class="px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors">Add Override</button>
                            </div>
                        </div>
                        
                        <!-- Current Overrides List -->
                        <div>
                            <h4 class="font-medium mb-4">Current Overrides</h4>
                            <div id="overridesList" class="space-y-2">
                                ${sortedDates.length === 0 ? 
                                    '<p class="text-gray-500 text-sm">No capacity overrides set.</p>' :
                                    sortedDates.map(date => {
                                        const capacity = currentOverrides[date];
                                        // Fix date display issue by parsing the date string properly
                                        const parsedDate = this.parseDateString(date);
                                        const formattedDate = parsedDate ? this.formatDateForDisplay(parsedDate) : date;
                                        return `
                                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                                <div>
                                                    <div class="font-medium">${formattedDate}</div>
                                                    <div class="text-sm text-gray-500">${capacity} slots (${Math.floor(capacity * 15 / 60)}h ${(capacity * 15) % 60}m)</div>
                                                </div>
                                                <button class="remove-override px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors" data-date="${date}">Remove</button>
                                            </div>
                                        `;
                                    }).join('')
                                }
                            </div>
                        </div>
                        
                        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                            <button class="close-overrides px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                const today = this.dateToLocalDateString(new Date());
                modal.querySelector('#overrideStartDate').value = today;
                
                modal.querySelectorAll('.close-overrides').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });
                });
                
                modal.querySelector('#quickAbsentToday').addEventListener('click', () => {
                    const today = this.dateToLocalDateString(new Date());
                    modal.querySelector('#overrideStartDate').value = today;
                    modal.querySelector('#overrideEndDate').value = '';
                    modal.querySelector('#overrideCapacity').value = '0';
                });
                
                modal.querySelector('#quickAbsentTomorrow').addEventListener('click', () => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = this.dateToLocalDateString(tomorrow);
                    modal.querySelector('#overrideStartDate').value = tomorrowStr;
                    modal.querySelector('#overrideEndDate').value = '';
                    modal.querySelector('#overrideCapacity').value = '0';
                });
                
                modal.querySelector('#quickAbsentWeekend').addEventListener('click', () => {
                    const today = new Date();
                    const saturday = new Date(today);
                    const sunday = new Date(today);
                    
                    const daysUntilSaturday = (6 - today.getDay()) % 7;
                    saturday.setDate(today.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
                    
                    sunday.setDate(saturday.getDate() + 1);
                    
                    modal.querySelector('#overrideStartDate').value = this.dateToLocalDateString(saturday);
                    modal.querySelector('#overrideEndDate').value = this.dateToLocalDateString(sunday);
                    modal.querySelector('#overrideCapacity').value = '0';
                });
                
                modal.querySelector('#addOverride').addEventListener('click', async () => {
                    const startDate = modal.querySelector('#overrideStartDate').value;
                    const endDate = modal.querySelector('#overrideEndDate').value;
                    const capacity = parseInt(modal.querySelector('#overrideCapacity').value) || 0;
                    
                    if (!startDate) {
                        this.showToast('Please select a start date', 'error');
                        return;
                    }
                    
                    await this.addCapacityOverride(person, startDate, endDate, capacity);
                    document.body.removeChild(modal);
                    this.showCapacityOverridesModal(person);
                });
                
                modal.querySelectorAll('.remove-override').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const date = btn.dataset.date;
                        await this.removeCapacityOverride(person, date);
                        document.body.removeChild(modal);
                        this.showCapacityOverridesModal(person);
                    });
                });
            }
            
            async addCapacityOverride(person, startDate, endDate, capacity) {
                if (!this.peopleSpecificCapacity[person]) {
                    this.peopleSpecificCapacity[person] = {};
                }
                
                const dates = [];
                
                if (endDate && endDate !== startDate) {
                    // Parse dates consistently to avoid timezone issues
                    const start = this.parseDateString(startDate);
                    const end = this.parseDateString(endDate);
                    
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        dates.push(this.dateToLocalDateString(d));
                    }
                } else {
                    // For single dates, ensure we use the exact date string format
                    dates.push(startDate);
                }
                
                dates.forEach(date => {
                    this.peopleSpecificCapacity[person][date] = capacity;
                });
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Updating capacity overrides...');
                    try {
                        await this.upsertCapacityOverridesInAirtable(person, dates, capacity);
                        this.showToast(`Capacity overrides updated for ${dates.length} date${dates.length !== 1 ? 's' : ''}`, 'success');
                    } catch (error) {
                        this.showToast(`Overrides added locally. Sync failed: ${error.message}`, 'warning');
                    } finally {
                        this.hideLoading();
                    }
                } else {
                    this.showToast(`Capacity overrides updated for ${dates.length} date${dates.length !== 1 ? 's' : ''}`, 'success');
                }
                
                this.renderWhiteboard();
                
                await this.saveCapacityOverridesToLocal();
            }
            
            async removeCapacityOverride(person, date) {
                console.log('🗑️ Removing capacity override:', { person, date });
                console.log('🔍 Before removal - peopleSpecificCapacity:', this.peopleSpecificCapacity);
                
                if (this.peopleSpecificCapacity[person]) {
                    delete this.peopleSpecificCapacity[person][date];
                    console.log(`✅ Deleted override for ${person} on ${date}`);
                    
                    if (Object.keys(this.peopleSpecificCapacity[person]).length === 0) {
                        delete this.peopleSpecificCapacity[person];
                        console.log(`✅ Deleted entire person entry for ${person} (no more overrides)`);
                    }
                }
                
                console.log('🔍 After removal - peopleSpecificCapacity:', this.peopleSpecificCapacity);
                
                // FORCE save to local storage immediately
                await this.saveCapacityOverridesToLocal();
                console.log('💾 Forced save to local storage completed');
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Removing capacity override...');
                    try {
                        await this.deleteCapacityOverrideFromAirtable(person, date);
                        console.log('✅ Successfully removed from Airtable');
                        this.showSuccessToast('sync', 'Capacity override');
                    } catch (error) {
                        console.error('❌ Failed to remove from Airtable:', error);
                        this.showToast(`Override removed locally. Sync failed: ${error.message}`, 'warning');
                    } finally {
                        this.hideLoading();
                    }
                } else {
                    this.showSuccessToast('delete', 'Capacity override');
                }
                
                // Force re-render
                this.renderWhiteboard();
                console.log('🎨 Forced whiteboard re-render completed');
            }
            
            async upsertCapacityOverridesInAirtable(person, dates, capacity) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.capacityOverrides || 'CapacityOverrides');
                
                try {
                    const personFilterFormula = `{Person}='${person}'`;
                    const allPersonRecords = await this.makeAirtableRequest(`${tableName}?filterByFormula=${encodeURIComponent(personFilterFormula)}`);
                    
                    for (const date of dates) {
                        const existingRecords = allPersonRecords.records.filter(record => 
                            record.fields.Date === date
                        );
                        
                        if (existingRecords.length > 0) {
                            const updateRecords = existingRecords.map(record => ({
                                id: record.id,
                                fields: {
                                    Person: person,
                                    Date: date,
                                    Capacity: capacity
                                }
                            }));
                            
                            while (updateRecords.length > 0) {
                                const batch = updateRecords.splice(0, 10);
                                const data = { records: batch };
                                await this.makeAirtableRequest(tableName, 'PATCH', data);
                            }
                            
                            if (existingRecords.length > 1) {
                                const duplicatesToDelete = existingRecords.slice(1);
                                
                                for (const record of duplicatesToDelete) {
                                    await this.makeAirtableRequest(`${tableName}/${record.id}`, 'DELETE');
                                }
                            }
                        } else {
                            const data = {
                                records: [{
                                    fields: {
                                        Person: person,
                                        Date: date,
                                        Capacity: capacity
                                    }
                                }]
                            };
                            await this.makeAirtableRequest(tableName, 'POST', data);
                        }
                    }
                } catch (error) {
                    if (error.message.includes('NOT_FOUND') || error.message.includes('Table not found')) {
                        throw new Error('CapacityOverrides table not found in Airtable. Please create this table first or capacity overrides will only save locally.');
                    }
                    throw error;
                }
            }
            
            async deleteCapacityOverrideFromAirtable(person, date) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.capacityOverrides || 'CapacityOverrides');
                
                const filterFormula = `AND({Person}='${person}',{Date}='${date}')`;
                const response = await this.makeAirtableRequest(`${tableName}?filterByFormula=${encodeURIComponent(filterFormula)}`);
                
                if (response.records.length > 0) {
                    const recordId = response.records[0].id;
                    await this.makeAirtableRequest(`${tableName}/${recordId}`, 'DELETE');
                }
            }
            
            // Task Operations
            async deleteTask(task) {
                let taskDeleted = false;
                
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const taskIndex = this.tasks[dateKey][person].findIndex(t => t.id === task.id);
                        if (taskIndex !== -1) {
                            this.tasks[dateKey][person].splice(taskIndex, 1);
                            taskDeleted = true;
                            break;
                        }
                    }
                    if (taskDeleted) break;
                }

                if (taskDeleted && this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Deleting order...');
                    try {
                        await this.deleteTaskFromAirtable(task.id);
                        this.showToast(`Order #${task.orderNumber} deleted successfully!`, 'success');
                    } catch (error) {
                        this.showToast(`Failed to delete order: ${error.message}`, 'error');
                    } finally {
                        this.hideLoading();
                    }
                } else if (taskDeleted) {
                    this.showToast(`Order #${task.orderNumber} deleted!`, 'success');
                }

                this.renderWhiteboard();
            }
            
            async deactivatePerson(person) {
                this.people = this.people.filter(p => p !== person);
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Updating person status...');
                    try {
                        await this.updatePersonActiveStatus(person, false);
                        this.showToast(`${person} removed from schedule`, 'success');
                    } catch (error) {
                        this.showToast(`Failed to update person status: ${error.message}`, 'error');
                    } finally {
                        this.hideLoading();
                    }
                }
                
                this.renderWhiteboard();
            }

initActivityBasedRefresh() {
    let lastActivity = Date.now();
    let wasIdle = false;
    const IDLE_TIME = 5 * 60 * 1000; // 5 minutes of inactivity
    
    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const onActivity = async () => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivity;
        
        // If user was idle for more than 5 minutes and now becomes active
        if (wasIdle && timeSinceLastActivity > IDLE_TIME && this.airtableConfig.apiKey && this.airtableConfig.baseId) {
            console.log('🔄 User returned after being idle - refreshing data');
            this.showToast('Welcome back! Refreshing data...', 'info');
            
            try {
                await this.performAutoRefresh();
            } catch (error) {
                console.warn('Activity-based refresh failed:', error);
            }
            
            wasIdle = false;
        }
        
        lastActivity = now;
    };
    
    // Attach activity listeners
// Add this to your constructor, near other event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set up due date auto-population on focus
    const dueDateInput = document.getElementById('dueDateInput');
    if (dueDateInput) {
        dueDateInput.addEventListener('focus', () => {
            // Only auto-populate if field is empty and offset > 0
            if (!dueDateInput.value && this.getDueDateOffset() > 0) {
                dueDateInput.value = this.getDefaultDueDate();
            }
        });
    }
});

    activityEvents.forEach(event => {
        document.addEventListener(event, onActivity, { passive: true });
    });
    
    // Check for idle state every minute
    setInterval(() => {
        const timeSinceLastActivity = Date.now() - lastActivity;
        wasIdle = timeSinceLastActivity > IDLE_TIME;
    }, 60 * 1000);
    
    console.log('🎯 Activity-based refresh initialized');
}
            
            // Auto-load functionality
            async checkForAutoLoad() {
                await this.loadCapacityOverridesFromLocal();
// CRITICAL FIX: Don't load people capacity from local storage
// Let Airtable data load first and save to local storage
// await this.loadPeopleCapacityFromLocal();
                await this.loadViewPreferences();
                await this.loadAutoRefreshSettings();
                await this.loadAutoCapacitySettings();
                
                const urlParams = new URLSearchParams(window.location.search);
                const baseId = urlParams.get('baseId');
                
                if (baseId) {
                    this.airtableConfig.baseId = baseId;
                    this.showQuickSetupDialog();
                    return;
                }
                
                const savedConfig = await this.loadSavedConfig();
if (savedConfig) {
    // CRITICAL FIX: Auto-load from Airtable if we have saved credentials
    this.airtableConfig.apiKey = savedConfig.apiKey;
    this.airtableConfig.baseId = savedConfig.baseId;
    if (savedConfig.tablesConfig) {
        this.airtableConfig.tablesConfig = savedConfig.tablesConfig;
    }
    
    try {
        this.showLoading('Loading data from Airtable...');
        await this.loadAllDataFromAirtable();
        this.renderWhiteboard();
        console.log('✅ Auto-loaded from saved Airtable config');
    } catch (error) {
        console.warn('Failed to auto-load from Airtable:', error);
        // Fallback to local storage if Airtable fails
        await this.loadPeopleCapacityFromLocal();
    } finally {
        this.hideLoading();
    }
}
            }
            
            showQuickSetupDialog() {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                modal.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4 fade-in">
                        <h3 class="text-lg font-semibold mb-4">🔗 Quick Setup</h3>
                        <p class="text-gray-700 mb-4">
                            Base ID detected! Enter your Airtable API key to restore your data.
                        </p>
                        <p class="text-sm text-gray-500 mb-4">
                            Base ID: <strong>${this.airtableConfig.baseId}</strong>
                        </p>
                        <input type="password" id="quickApiKey" placeholder="Enter your Airtable API Key" 
                               class="w-full p-3 text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-transparent mb-4">
                        <div class="flex justify-end space-x-3">
                            <button class="cancel-quick-setup px-4 py-2 text-gray-600  hover:bg-gray-100  rounded-lg transition-colors">Cancel</button>
                            <button class="confirm-quick-setup px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors">Connect</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                const apiKeyInput = modal.querySelector('#quickApiKey');
                apiKeyInput.focus();

                modal.querySelector('.cancel-quick-setup').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });

                modal.querySelector('.confirm-quick-setup').addEventListener('click', async () => {
                    const apiKey = apiKeyInput.value.trim();
                    if (apiKey) {
                        this.airtableConfig.apiKey = apiKey;
                        document.body.removeChild(modal);
                        
                        this.showLoading('Connecting to Airtable...');
                        try {
                            await this.loadAllDataFromAirtable();
                            this.renderWhiteboard();
                            this.showSuccessToast('connect');
                            await this.saveConfigToIndexedDB();
                        } catch (error) {
                            this.showToast(`Failed to connect: ${error.message}`, 'error');
                            this.showSettingsModal();
                        } finally {
                            this.hideLoading();
                        }
                    }
                });

                apiKeyInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        modal.querySelector('.confirm-quick-setup').click();
                    }
                });
            }
            
            async autoConnectWithSavedConfig(savedConfig) {
                this.showLoading('Auto-connecting...');
                
                try {
                    this.airtableConfig.apiKey = savedConfig.apiKey;
                    this.airtableConfig.baseId = savedConfig.baseId;
                    if (savedConfig.tablesConfig) {
                        this.airtableConfig.tablesConfig = savedConfig.tablesConfig;
                    }
                    
                    const response = await fetch(`https://api.airtable.com/v0/${this.airtableConfig.baseId}/${this.airtableConfig.tablesConfig.people}`, {
                        headers: {
                            'Authorization': `Bearer ${this.airtableConfig.apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Connection failed');
                    }
                    
                    await this.loadAllDataFromAirtable();
                    this.renderWhiteboard();
                    this.showToast('Auto-connected successfully!', 'success');
                    
                } catch (error) {
                    await this.clearSavedConfig();
                    this.showToast(`Auto-connect failed: ${error.message}`, 'error');
                } finally {
                    this.hideLoading();
                }
            }
            
            // Config persistence
            async saveConfigToIndexedDB() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const configToSave = {
                        id: 'current',
                        apiKey: this.airtableConfig.apiKey,
                        baseId: this.airtableConfig.baseId,
                        tablesConfig: this.airtableConfig.tablesConfig,
                        lastSaved: new Date().toISOString()
                    };
                    
                    await store.put(configToSave);
                    
                    await this.saveCapacityOverridesToLocal();
                } catch (error) {
                    console.warn('Could not save config:', error);
                }
            }
            
            async loadSavedConfig() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('current');
                        request.onsuccess = () => resolve(request.result || null);
                        request.onerror = () => resolve(null);
                    });
                } catch (error) {
                    return null;
                }
            }
            
            async clearSavedConfig() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    await store.delete('current');
                } catch (error) {
                    console.warn('Could not clear config:', error);
                }
            }
            
            openConfigDatabase() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('TaskSchedulerConfig', 1);
                    
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                    
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains('config')) {
                            db.createObjectStore('config', { keyPath: 'id' });
                        }
                    };
                });
            }

            async saveCapacityOverridesToLocal() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const overridesToSave = {
                        id: 'capacity-overrides',
                        data: this.peopleSpecificCapacity,
                        lastSaved: new Date().toISOString()
                    };
                    
                    return new Promise((resolve, reject) => {
                        const request = store.put(overridesToSave);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save capacity overrides:', error);
                }
            }
            
            async loadCapacityOverridesFromLocal() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('capacity-overrides');
                        request.onsuccess = () => {
                            const result = request.result;
                            if (result && result.data) {
                                this.peopleSpecificCapacity = result.data;
                            }
                            resolve(result ? result.data : null);
                        };
                        request.onerror = () => resolve(null);
                    });
                } catch (error) {
                    return null;
                }
            }
            
            async savePeopleCapacityToLocal() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const capacityToSave = {
                        id: 'people-capacity',
                        data: this.peopleCapacity,
                        lastSaved: new Date().toISOString()
                    };
                    
                    return new Promise((resolve, reject) => {
                        const request = store.put(capacityToSave);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save people capacity:', error);
                }
            }
            
            async loadPeopleCapacityFromLocal() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('people-capacity');
                        request.onsuccess = () => {
                            const result = request.result;
                            if (result && result.data) {
                                this.peopleCapacity = result.data;
                            }
                            resolve(result ? result.data : null);
                        };
                        request.onerror = () => resolve(null);
                    });
                } catch (error) {
                    return null;
                }
            }
            
            // Context Menu for Tasks
            showTaskContextMenu(event, task) {
                // Remove any existing context menu
                this.removeContextMenu();
                
                const menu = document.createElement('div');
                menu.className = 'fixed bg-white border border-gray-300 rounded-lg shadow-xl py-2 min-w-[160px]';
                menu.style.zIndex = '9999';
                menu.id = 'taskContextMenu';
                
                const menuItems = [
                    {
                        icon: '✏️',
                        text: 'Edit Order',
                        action: () => this.editTask(task)
                    },
                    {
                        icon: '📋',
                        text: 'Duplicate Order',
                        action: () => this.duplicateTask(task)
                    },
                    {
                        icon: task.completed ? '🔄' : '✅',
                        text: task.completed ? 'Mark Incomplete' : 'Mark Complete',
                        action: () => this.toggleTaskCompletion(task)
                    },
                    {
                        icon: '📄',
                        text: 'View Details',
                        action: () => this.showTaskDetails(task)
                    },
                    { divider: true },
                    {
                        icon: '🗑️',
                        text: 'Delete Order',
                        action: () => this.showDeleteConfirmation(task),
                        className: 'text-red-600 hover:bg-red-50'
                    }
                ];
                
                menuItems.forEach(item => {
                    if (item.divider) {
                        const divider = document.createElement('div');
                        divider.className = 'h-px bg-gray-200 my-1';
                        menu.appendChild(divider);
                    } else {
                        const menuItem = document.createElement('button');
                        menuItem.className = `w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center space-x-3 ${item.className || ''}`;
                        menuItem.innerHTML = `
                            <span class="text-base">${item.icon}</span>
                            <span>${item.text}</span>
                        `;
                        menuItem.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.removeContextMenu();
                            item.action();
                        });
                        menu.appendChild(menuItem);
                    }
                });
                
                // Position the menu
                let x = event.clientX;
                let y = event.clientY;
                
                // Ensure menu stays within viewport
                document.body.appendChild(menu);
                const rect = menu.getBoundingClientRect();
                
                if (x + rect.width > window.innerWidth) {
                    x = window.innerWidth - rect.width - 10;
                }
                if (y + rect.height > window.innerHeight) {
                    y = window.innerHeight - rect.height - 10;
                }
                
                menu.style.left = `${x}px`;
                menu.style.top = `${y}px`;
                
                // Close menu when clicking outside
                document.addEventListener('click', this.removeContextMenu.bind(this), { once: true });
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this.removeContextMenu();
                    }
                }, { once: true });
            }
            
            removeContextMenu() {
                const existingMenu = document.getElementById('taskContextMenu');
                if (existingMenu) {
                    existingMenu.remove();
                }
            }
            
            // Duplicate Task Functionality
            async duplicateTask(originalTask) {
                // Find the current task location
                let currentPerson = null;
                let currentDateKey = null;
                
                for (const dateKey in this.tasks) {
                    for (const person in this.tasks[dateKey]) {
                        const foundTask = this.tasks[dateKey][person].find(t => t.id === originalTask.id);
                        if (foundTask) {
                            currentPerson = person;
                            currentDateKey = dateKey;
                            break;
                        }
                    }
                    if (currentPerson) break;
                }
                
                // Create duplicate with modified order number
                const duplicatedTask = {
                    ...originalTask,
                    id: Date.now() + Math.random(),
                    orderNumber: `${originalTask.orderNumber}-COPY`,
                    position: this.findOptimalPosition(currentPerson, currentDateKey, originalTask.duration),
                    completed: false // Always start duplicates as incomplete
                };
                
                // Add to the same person and date
                this.addTaskToSpecificDate(currentPerson, duplicatedTask, currentDateKey);
                
                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Duplicating order...');
                    try {
                        const recordId = await this.createTaskInAirtable(duplicatedTask, currentPerson, currentDateKey);
                        duplicatedTask.id = recordId;
                        this.showToast(`Order #${originalTask.orderNumber} duplicated successfully!`, 'success');
                    } catch (error) {
                        this.showToast(`Order duplicated locally. Sync failed: ${error.message}`, 'warning');
                    } finally {
                        this.hideLoading();
                    }
                } else {
                    this.showToast(`Order #${originalTask.orderNumber} duplicated!`, 'success');
                }
                
                this.renderWhiteboard();
                
                // Highlight the new duplicate
                setTimeout(() => {
                    this.highlightOrder(duplicatedTask.orderNumber, currentPerson);
                }, 200);
            }
            
            // Enhanced Auto-Complete System
            setupEnhancedAutoComplete() {
                const descriptionInput = document.getElementById('descriptionInput');
                if (!descriptionInput) return;
                
                let autocompleteList = null;
                let currentSuggestions = [];
                let selectedIndex = -1;
                
                const createAutocompleteList = () => {
                    if (autocompleteList) {
                        autocompleteList.remove();
                    }
                    
                    autocompleteList = document.createElement('div');
                    autocompleteList.className = 'absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 mt-1';
                    autocompleteList.style.display = 'none';
                    
                    descriptionInput.parentNode.style.position = 'relative';
                    descriptionInput.parentNode.appendChild(autocompleteList);
                };
                
                const showSuggestions = (suggestions) => {
                    if (!autocompleteList) createAutocompleteList();
                    
                    currentSuggestions = suggestions;
                    selectedIndex = -1;
                    
                    if (suggestions.length === 0) {
                        autocompleteList.style.display = 'none';
                        return;
                    }
                    
                    autocompleteList.innerHTML = '';
                    
                    suggestions.forEach((suggestion, index) => {
                        const item = document.createElement('div');
                        item.className = 'px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0';
                        item.textContent = suggestion.text;
                        item.dataset.index = index;
                        
                        if (suggestion.isPartial) {
                            item.innerHTML += ' <span class="text-xs text-gray-500">(partial match)</span>';
                        }
                        
                        item.addEventListener('click', () => {
                            applySuggestion(suggestion);
                        });
                        
                        autocompleteList.appendChild(item);
                    });
                    
                    autocompleteList.style.display = 'block';
                };
                
                const applySuggestion = (suggestion) => {
                    const currentValue = descriptionInput.value;
                    const cursorPosition = descriptionInput.selectionStart;
                    
                    if (suggestion.isPartial) {
                        // Replace the current word being typed
                        const beforeCursor = currentValue.substring(0, cursorPosition);
                        const afterCursor = currentValue.substring(cursorPosition);
                        const words = beforeCursor.split(/\s+/);
                        words[words.length - 1] = suggestion.text;
                        const newValue = words.join(' ') + ' ' + afterCursor;
                        descriptionInput.value = newValue;
                        const newCursorPos = words.join(' ').length + 1;
                        descriptionInput.setSelectionRange(newCursorPos, newCursorPos);
                    } else {
                        // Replace entire content
                        descriptionInput.value = suggestion.text;
                    }
                    
                    autocompleteList.style.display = 'none';
                    descriptionInput.focus();
                };
                
                const updateSelection = (direction) => {
                    if (currentSuggestions.length === 0) return;
                    
                    const items = autocompleteList.querySelectorAll('[data-index]');
                    
                    // Remove previous highlight
                    items.forEach(item => item.classList.remove('bg-blue-100'));
                    
                    if (direction === 'down') {
                        selectedIndex = (selectedIndex + 1) % currentSuggestions.length;
                    } else if (direction === 'up') {
                        selectedIndex = selectedIndex === -1 ? currentSuggestions.length - 1 : (selectedIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
                    }
                    
                    if (selectedIndex >= 0) {
                        items[selectedIndex].classList.add('bg-blue-100');
                        items[selectedIndex].scrollIntoView({ block: 'nearest' });
                    }
                };
                
                descriptionInput.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    if (value.length < 2) {
                        if (autocompleteList) autocompleteList.style.display = 'none';
                        return;
                    }
                    
                    const suggestions = this.getDescriptionSuggestions(value);
                    showSuggestions(suggestions);
                });
                
                descriptionInput.addEventListener('keydown', (e) => {
                    if (!autocompleteList || autocompleteList.style.display === 'none') return;
                    
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            updateSelection('down');
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            updateSelection('up');
                            break;
                        case 'Enter':
                            e.preventDefault();
                            if (selectedIndex >= 0) {
                                applySuggestion(currentSuggestions[selectedIndex]);
                            }
                            break;
                        case 'Escape':
                            autocompleteList.style.display = 'none';
                            break;
                    }
                });
                
                // Hide suggestions when clicking outside
                document.addEventListener('click', (e) => {
                    if (autocompleteList && !descriptionInput.contains(e.target) && !autocompleteList.contains(e.target)) {
                        autocompleteList.style.display = 'none';
                    }
                });
                
                // Add hide/show preview functionality
                document.getElementById('hidePreviewBtn').addEventListener('click', () => {
                    document.getElementById('printPreviewSection').style.display = 'none';
                });
                
                // Add a button to show preview (we'll add this to the tag table section)
                const showPreviewBtn = document.createElement('button');
                showPreviewBtn.id = 'showPreviewBtn';
                showPreviewBtn.className = 'px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors';
                showPreviewBtn.textContent = 'Show Preview';
                showPreviewBtn.addEventListener('click', () => {
                    document.getElementById('printPreviewSection').style.display = 'block';
                    this.updateTagPreview();
                });
                
                // Insert the show preview button next to the update button
                const updateBtn = document.getElementById('updateTagQuantity');
                if (updateBtn && updateBtn.parentNode) {
                    updateBtn.parentNode.appendChild(showPreviewBtn);
                }
            }
            
            getDescriptionSuggestions(input) {
                const suggestions = [];
                const inputLower = input.toLowerCase();
                
                // Get all existing descriptions
                const allDescriptions = [];
                Object.keys(this.tasks).forEach(dateKey => {
                    Object.keys(this.tasks[dateKey]).forEach(person => {
                        this.tasks[dateKey][person].forEach(task => {
                            if (task.description && task.description.trim()) {
                                allDescriptions.push(task.description.trim());
                            }
                        });
                    });
                });
                
                // Remove duplicates
                const uniqueDescriptions = [...new Set(allDescriptions)];
                
                // Exact matches first
                uniqueDescriptions.forEach(desc => {
                    if (desc.toLowerCase() === inputLower) {
                        suggestions.push({ text: desc, isPartial: false, score: 100 });
                    }
                });
                
                // Starts with matches
                uniqueDescriptions.forEach(desc => {
                    if (desc.toLowerCase().startsWith(inputLower) && desc.toLowerCase() !== inputLower) {
                        suggestions.push({ text: desc, isPartial: false, score: 90 });
                    }
                });
                
                // Contains matches
                uniqueDescriptions.forEach(desc => {
                    if (desc.toLowerCase().includes(inputLower) && !desc.toLowerCase().startsWith(inputLower)) {
                        suggestions.push({ text: desc, isPartial: false, score: 80 });
                    }
                });
                
                // Word-based partial matches
                const words = inputLower.split(/\s+/);
                const lastWord = words[words.length - 1];
                
                if (lastWord.length >= 2) {
                    const wordMatches = new Set();
                    
                    uniqueDescriptions.forEach(desc => {
                        const descWords = desc.toLowerCase().split(/\s+/);
                        descWords.forEach(word => {
                            if (word.startsWith(lastWord) && word !== lastWord && !wordMatches.has(word)) {
                                wordMatches.add(word);
                                suggestions.push({ text: word, isPartial: true, score: 70 });
                            }
                        });
                    });
                }
                
                // Sort by score and limit
                return suggestions
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 8);
            }
            
            // Airtable API Functions
async makeAirtableRequest(endpoint, method = 'GET', data = null, silent = false) {
    const url = `https://api.airtable.com/v0/${this.airtableConfig.baseId}/${endpoint}`;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const options = {
                method,
                headers: {
                    'Authorization': `Bearer ${this.airtableConfig.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
                if (!silent) {
                    console.log('🚀 FORCE AIRTABLE REQUEST:', {
                        url,
                        method,
                        data,
                        force: 'BYPASSING ALL VALIDATION'
                    });
                }
            }

            const response = await fetch(url, options);
            if (!silent) {
                console.log('📡 Airtable response status:', response.status);
            }
            
            if (!response.ok) {
                const error = await response.json();
                if (!silent) {
                    console.error('❌ Airtable error response:', error);
                }
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!silent) {
                console.log('✅ Airtable success response:', result);
            }
            
            // Reset error count on success
            this.errorCount = 0;
            return result;
            
        } catch (error) {
            if (!silent) {
                console.warn(`Airtable request attempt ${attempt}/${maxRetries} failed:`, error.message);
            }
            
            if (attempt === maxRetries) {
                // Add to retry queue if offline
                if (!navigator.onLine) {
                    this.retryQueue = this.retryQueue || [];
                    this.retryQueue.push(() => this.makeAirtableRequest(endpoint, method, data, silent));
                }
                if (!silent) {
                    this.handleProductionError(error, 'airtableRequest');
                }
                throw error;
            }
            
            // Wait before retry: 1s, 2s, 4s
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
            // Verification Functions for Data Integrity
            async verifyTaskInAirtable(taskId, expectedFields) {
                try {
                    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                    const response = await this.makeAirtableRequest(`${tableName}/${taskId}`);
                    
                    // Verify each expected field
                    for (const [fieldName, expectedValue] of Object.entries(expectedFields)) {
                        const actualValue = response.fields[fieldName];
                        if (actualValue !== expectedValue) {
                            console.warn(`⚠️ Field verification failed for ${fieldName}:`, {
                                expected: expectedValue,
                                actual: actualValue,
                                taskId: taskId
                            });
                            // Still consider it a success since the record exists, just log the discrepancy
                        }
                    }
                    
                    console.log('✅ Task verification successful:', taskId);
                    return true;
                } catch (error) {
                    console.error('❌ Task verification failed:', error);
                    throw new Error(`Failed to verify task in Airtable: ${error.message}`);
                }
            }

            async verifyTaskDeletion(taskId) {
                try {
                    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                    await this.makeAirtableRequest(`${tableName}/${taskId}`, 'GET', null, true); // ← Add silent=true
                    
                    // If we get here, the record still exists (not deleted)
                    console.error('❌ Task deletion verification failed - record still exists:', taskId);
                    throw new Error('Task was not properly deleted from Airtable');
                } catch (error) {
                    if (error.message.includes('NOT_FOUND') || 
                        error.message.includes('404') || 
                        error.message.includes('403') || 
                        error.message.includes('Forbidden') ||
                        error.message.includes('Invalid permissions')) {
                        // These responses indicate the record was deleted successfully
                        // 404 = Not Found, 403 = Forbidden (common after deletion)
                        console.log('✅ Task deletion verification successful:', taskId);
                        return true;
                    } else {
                        // Some other unexpected error occurred
                        console.error('❌ Task deletion verification failed with unexpected error:', error);
                        throw new Error(`Failed to verify task deletion: ${error.message}`);
                    }
                }
            }
            
          
 async loadPeopleFromAirtable() {
    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.people);
    const response = await this.makeAirtableRequest(tableName);
    
    this.people = [];
    if (!this.peopleCapacity) {
        this.peopleCapacity = {};
    }

    response.records.forEach(record => {
        const fields = record.fields;
        
        // Skip invalid or system records
        if (!fields.Name || fields.Name.startsWith('__')) {
            return;
        }
        
        const isActive = fields.Active !== false;
        
        if (isActive) {
            this.people.push(fields.Name);
            
            // Build weekly capacity from Airtable fields
            const weeklyCapacity = {};
            this.DAYS_OF_WEEK.forEach(day => {
                // Use nullish coalescing to preserve 0 values from Airtable
                weeklyCapacity[day] = fields[`Capacity${day}`] ?? 16;
            });

            // Always update weekly capacity from Airtable (source of truth)
            this.peopleCapacity[fields.Name] = weeklyCapacity;
        }
    });
}
            
            async loadTasksFromAirtable() {
                console.log('🔄 Loading tasks from Airtable...');
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                
                this.tasks = {};
                let allRecords = [];
                let offset = null;
                let pageCount = 0;

                // Calculate date range for filtering
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - (this.dataLoadSettings.weeksBack * 7));
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + (this.dataLoadSettings.weeksForward * 7));
                
                const startDateStr = this.dateToLocalDateString(startDate);
                const endDateStr = this.dateToLocalDateString(endDate);
                
                console.log(`📅 Loading tasks from ${startDateStr} to ${endDateStr} (${this.dataLoadSettings.weeksBack} weeks back, ${this.dataLoadSettings.weeksForward} weeks forward)`);
                
                // Create filter formula for date range
                const filterFormula = `AND({Date}>='${startDateStr}',{Date}<='${endDateStr}')`;
                const encodedFilter = encodeURIComponent(filterFormula);

                // Fetch all records using pagination with date filter
                do {
                    pageCount++;
                    const url = offset ? 
                        `${tableName}?filterByFormula=${encodedFilter}&offset=${offset}` : 
                        `${tableName}?filterByFormula=${encodedFilter}`;
                    
                    const response = await this.makeAirtableRequest(url);
                    
                    console.log(`📦 Page ${pageCount} response:`, {
                        recordsInPage: response.records.length,
                        hasOffset: !!response.offset,
                        totalRecordsSoFar: allRecords.length + response.records.length
                    });
                    
                    allRecords = allRecords.concat(response.records);
                    offset = response.offset;
                    
                } while (offset);

                console.log(`📊 Total records loaded across ${pageCount} pages:`, allRecords.length);

                // Store the current loaded range
                this.dataLoadSettings.currentLoadedRange = {
                    startDate: startDateStr,
                    endDate: endDateStr,
                    loadedAt: new Date().toISOString()
                };

                allRecords.forEach((record, index) => {
                    const fields = record.fields;
                    console.log(`📋 Processing record ${index + 1}/${allRecords.length}:`, {
                        id: record.id,
                        orderNumber: fields.OrderNumber,
                        hasRequiredFields: !!(fields.Person && fields.Date && fields.OrderNumber)
                    });
                    
                    if (fields.Person && fields.Date && fields.OrderNumber) {
                        const dateKey = fields.Date;
                        if (!this.tasks[dateKey]) this.tasks[dateKey] = {};
                        if (!this.tasks[dateKey][fields.Person]) this.tasks[dateKey][fields.Person] = [];

                        const task = {
                            id: record.id,
                            orderNumber: fields.OrderNumber,
                            dateDue: fields.DateDue,
                            description: fields.Description || '',
                            duration: fields.Duration || 2,
                            tagsQuantity: fields.TagsQuantity || 1,
                            position: fields.Position || 0,
                            completed: fields.Completed || false
                        };
                        
                        console.log(`✅ Adding task to local state:`, task);
                        this.tasks[dateKey][fields.Person].push(task);
                    } else {
                        console.warn(`⚠️ Skipping record ${record.id} - missing required fields:`, {
                            Person: fields.Person,
                            Date: fields.Date,
                            OrderNumber: fields.OrderNumber
                        });
                    }
                });
                
                console.log('🎯 Final loaded tasks state:', this.tasks);
                console.log('📈 Summary:', {
                    totalRecords: allRecords.length,
                    totalDates: Object.keys(this.tasks).length,
                    dateRange: `${startDateStr} to ${endDateStr}`,
                    tasksByDate: Object.keys(this.tasks).map(date => ({
                        date,
                        people: Object.keys(this.tasks[date]),
                        totalTasks: Object.values(this.tasks[date]).flat().length
                    }))
                });
            }
            
            async loadCapacityOverridesFromAirtable() {
                try {
                    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.capacityOverrides || 'CapacityOverrides');
                    
                    // Load ALL capacity override records with pagination
                    let allRecords = [];
                    let offset = null;
                    
                    do {
                        const url = offset ? `${tableName}?offset=${offset}` : tableName;
                        const response = await this.makeAirtableRequest(url);
                        allRecords = allRecords.concat(response.records);
                        offset = response.offset;
                        console.log(`📄 Loaded ${response.records.length} capacity override records (total: ${allRecords.length})`);
                    } while (offset);
                    
                    console.log(`📊 Total capacity override records loaded: ${allRecords.length}`);
                    
                    if (!this.peopleSpecificCapacity) {
                        this.peopleSpecificCapacity = {};
                    }

                    // Clear existing overrides before loading fresh data
                    this.peopleSpecificCapacity = {};

                    allRecords.forEach(record => {
                        const fields = record.fields;
                        if (fields.Person && fields.Date && fields.Capacity !== undefined) {
                            if (!this.peopleSpecificCapacity[fields.Person]) {
                                this.peopleSpecificCapacity[fields.Person] = {};
                            }
                            
                            // Ensure date format consistency using normalizeDate
                            const dateKey = this.normalizeDate(fields.Date);
                            this.peopleSpecificCapacity[fields.Person][dateKey] = fields.Capacity;
                            
                            console.log(`✅ Loaded capacity override: ${fields.Person} on ${dateKey} = ${fields.Capacity} slots`);
                        }
                    });

                    console.log('📋 Final peopleSpecificCapacity state:', this.peopleSpecificCapacity);
                    await this.saveCapacityOverridesToLocal();
                    
                    // Force whiteboard re-render to show updated capacities
                    if (allRecords.length > 0) {
                        console.log('🎨 Re-rendering whiteboard to show capacity overrides...');
                        this.renderWhiteboard();
                    }
                    
                } catch (error) {
                    console.warn('⚠️ Could not load capacity overrides from Airtable:', error);
                    if (error.message.includes('NOT_FOUND') || error.message.includes('Table not found')) {
                        this.showCapacityOverridesSetupInfo();
                    }
                    if (!this.peopleSpecificCapacity) {
                        this.peopleSpecificCapacity = {};
                    }
                }
            }

async loadAllDataFromAirtable() {
    const performanceTracker = performance.now();
    this.showLoading('🚀 Loading all data in parallel...');
    console.log('🚀 Starting parallel data loading...');
    
    try {
        // Execute ALL THREE loads in parallel - including people data!
        const [peopleResult, tasksResult, capacityResult] = await Promise.all([
            this.loadPeopleFromAirtable(),    // ← THIS WAS MISSING!
            this.loadTasksFromAirtable(),
            this.loadCapacityOverridesFromAirtable()
        ]);
        
        const duration = performance.now() - performanceTracker;
        console.log(`⚡ Parallel loading completed in ${duration.toFixed(2)}ms`);
        
        // Performance feedback
        if (duration < 3000) {
            console.log('🚀 Excellent performance - under 3 seconds!');
        } else if (duration < 5000) {
            console.log('👍 Good performance - under 5 seconds');
        } else {
            console.log('⚠️ Slow performance - over 5 seconds, check network');
        }
        
        // CRITICAL FIX: Save fresh Airtable people capacity to local storage
        await this.savePeopleCapacityToLocal();
        await this.loadTextContentFromAirtable();
        
        // Re-render whiteboard after all loads complete
        console.log('🎨 Starting final whiteboard render...');
        console.log('📊 Tasks data check:', Object.keys(this.tasks).length, 'dates loaded');
        console.log('📊 People data check:', this.people.length, 'people loaded');
        console.log('📊 Sample people capacity:', this.peopleCapacity);

        // 🎯 DYNAMIC FIX: Extract people from loaded tasks if needed
        if (this.people.length === 0 && Object.keys(this.tasks).length > 0) {
            const peopleSet = new Set();
            Object.values(this.tasks).forEach(dayTasks => {
                Object.keys(dayTasks).forEach(person => {
                    peopleSet.add(person);
                });
            });
            this.people = Array.from(peopleSet);
            console.log('✅ Dynamically extracted people:', this.people);
        }
        
        if (this.autoCapacityRule && this.autoCapacityRule.enabled) {
            this.applyAutoCapacityRule();
        }
        
        this.renderWhiteboard();
        
    } catch (error) {
        console.error('❌ Parallel loading failed:', error);
        this.showErrorToast('Failed to load data from Airtable');
    } finally {
        this.hideLoading();
    }
}
            showCapacityOverridesSetupInfo() {
                if (this.hasShownCapacitySetupInfo) return;
                this.hasShownCapacitySetupInfo = true;

                const message = `
                    <div class="text-center">
                        <div class="mb-4">
                            <svg class="w-12 h-12 mx-auto text-blue-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">📅 Capacity Overrides Setup</h3>
                        </div>
                        <div class="text-left space-y-3 text-sm text-gray-700">
                            <p><strong>Quick Capacity Overrides aren't syncing between devices?</strong></p>
                            <p>To sync capacity overrides (like absent days, half days, etc.) across devices, you need to create a "CapacityOverrides" table in Airtable:</p>
                            <div class="bg-gray-50 p-3 rounded border mt-3 mb-3">
                                <p class="font-medium mb-2">Create this table structure:</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li><strong>Person</strong> (Single line text)</li>
                                    <li><strong>Date</strong> (Date field)</li>
                                    <li><strong>Capacity</strong> (Number field)</li>
                                </ul>
                            </div>
                            <p class="text-xs text-gray-500">Without this table, capacity overrides only save locally and won't sync between browsers or devices.</p>
                        </div>
                        <div class="mt-6">
                            <button class="understand-btn w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                Got it! I'll create the table later
                            </button>
                        </div>
                    </div>
                `;

                const modal = this.createModal('📅 Capacity Overrides Setup', message, { 
                    maxWidth: 'max-w-md',
                    showCloseButton: false 
                });

                modal.querySelector('.understand-btn').addEventListener('click', () => {
                    this.closeModal(modal);
                });
            }
            
            async createPersonInAirtable(name, weeklyCapacity, isActive) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.people);
                
                const fields = { 
                    Name: name,
                    Active: isActive
                };
                this.DAYS_OF_WEEK.forEach(day => {
                    fields[`Capacity${day}`] = weeklyCapacity[day];
                });
                
                const data = {
                    records: [{ fields }]
                };

                await this.makeAirtableRequest(tableName, 'POST', data);
            }
            
            async updatePersonActiveStatus(name, isActive) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.people);
                
                const response = await this.makeAirtableRequest(`${tableName}?filterByFormula={Name}='${name}'`);
                
                if (response.records.length > 0) {
                    const recordId = response.records[0].id;
                    
                    const data = {
                        records: [{
                            id: recordId,
                            fields: { Active: isActive }
                        }]
                    };

                    await this.makeAirtableRequest(tableName, 'PATCH', data);
                }
            }
            
	    async preserveHistoricalCapacity(personName, oldWeeklyCapacity) {
             
                if (!this.airtableConfig.apiKey || !this.airtableConfig.baseId) {
                    return;
                }
                
                try {
                    // Step 1: Get all existing tasks for this person
                    const tasksTableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                    const personFilter = `{Person}='${personName}'`;
                    const response = await this.makeAirtableRequest(`${tasksTableName}?filterByFormula=${encodeURIComponent(personFilter)}`);
                    
                    if (response.records.length === 0) {

                        return;
                    }
                    
                    // Step 2: Get unique past dates (exclude today and future)
                    const today = new Date();
                    const todayStr = this.dateToLocalDateString(today);
                    
                    const pastDates = new Set();
                    response.records.forEach(record => {
                        const taskDate = record.fields.Date;
                        if (taskDate && taskDate < todayStr) {
                            pastDates.add(taskDate);
                        }
                    });
                    
                    if (pastDates.size === 0) {
                        console.log(`ℹ️ No past dates found for ${personName} - no historical preservation needed`);
                        return;
                    }
                    
                    console.log(`📅 Found ${pastDates.size} past dates to preserve for ${personName}:`, Array.from(pastDates).sort());
                    
                    // Step 3: For each past date, check if there's already a capacity override
                    const overridesTableName = encodeURIComponent(this.airtableConfig.tablesConfig.capacityOverrides || 'CapacityOverrides');
                    let existingOverrides = new Set();
                    
                    try {
                        const overridesResponse = await this.makeAirtableRequest(`${overridesTableName}?filterByFormula=${encodeURIComponent(`{Person}='${personName}'`)}`);
                        overridesResponse.records.forEach(record => {
                            if (record.fields.Date) {
                                existingOverrides.add(record.fields.Date);
                            }
                        });
                        console.log(`📋 Found ${existingOverrides.size} existing capacity overrides for ${personName}`);
                    } catch (error) {
                        console.warn('⚠️ Could not load existing capacity overrides (table may not exist):', error.message);
                    }
                    
                    // Step 4: Create capacity overrides for past dates that don't already have them
                    let preservedCount = 0;
                    const overridesToCreate = [];
                    
                    for (const dateStr of pastDates) {
                        if (!existingOverrides.has(dateStr)) {
                            const date = this.parseDateString(dateStr);
                            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

// CRITICAL FIX: Use OLD weekly capacity instead of current (potentially updated) capacity
const historicalCapacity = oldWeeklyCapacity?.[dayName] || this.peopleCapacity[personName]?.[dayName] || 16;
                            
                            overridesToCreate.push({
                                fields: {
                                    Person: personName,
                                    Date: dateStr,
                                    Capacity: historicalCapacity
                                }
                            });
                            
                            console.log(`🔒 Preserving capacity for ${personName} on ${dateStr}: ${historicalCapacity} slots`);
                            preservedCount++;
                        } else {
                            console.log(`✅ Capacity already preserved for ${personName} on ${dateStr}`);
                        }
                    }
                    
                    // Step 5: Batch create the capacity overrides
                    if (overridesToCreate.length > 0) {
                        // Airtable API allows max 10 records per request
                        const batchSize = 10;
                        for (let i = 0; i < overridesToCreate.length; i += batchSize) {
                            const batch = overridesToCreate.slice(i, i + batchSize);
                            const batchData = { records: batch };
                            
                            try {
                                await this.makeAirtableRequest(overridesTableName, 'POST', batchData);
                                console.log(`✅ Created batch of ${batch.length} capacity overrides`);
                            } catch (error) {
                                console.error(`❌ Failed to create capacity override batch:`, error);
                                throw error;
                            }
                        }
                        
                        console.log(`🎯 Successfully preserved historical capacity for ${preservedCount} dates`);
                    } else {
                        console.log(`ℹ️ All historical dates already have capacity overrides - no preservation needed`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to preserve historical capacity for ${personName}:`, error);
                    throw new Error(`Could not preserve historical data: ${error.message}`);
                }
            }

async updatePersonWeeklyCapacity(name, weeklyCapacity) {
    console.log(`🔄 Starting weekly capacity update for ${name}...`);
    
    // STEP 1: Get OLD weekly capacity before making any changes
    const oldWeeklyCapacity = { ...this.peopleCapacity[name] };
    
    // STEP 2: Preserve historical capacity using OLD values
    await this.preserveHistoricalCapacity(name, oldWeeklyCapacity);
    
    // STEP 3: Update the weekly capacity in Airtable
    await this.updatePersonWeeklyCapacityInAirtable(name, weeklyCapacity);
}
            
            async updatePersonWeeklyCapacityInAirtable(name, weeklyCapacity) {
                console.log(`📝 Updating weekly capacity in Airtable for ${name}...`);
                
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.people);
                const response = await this.makeAirtableRequest(`${tableName}?filterByFormula={Name}='${name}'`);
                
                if (response.records.length > 0) {
                    const recordId = response.records[0].id;
                    
                    const fields = {};
                    this.DAYS_OF_WEEK.forEach(day => {
                        fields[`Capacity${day}`] = weeklyCapacity[day];
                    });
                    
                    const data = {
                        records: [{
                            id: recordId,
                            fields: fields
                        }]
                    };

                    await this.makeAirtableRequest(tableName, 'PATCH', data);
                    console.log(`✅ Weekly capacity updated in Airtable for ${name}`);
                } else {
                    throw new Error(`Person ${name} not found in Airtable`);
                }
            }
            
            async createTaskInAirtable(task, person, date) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                
                // Define field sets to try in order (from most complete to minimal)
                const fieldSets = [
                    // Full field set
                    {
                        OrderNumber: task.orderNumber,
                        Person: person,
                        Date: date,
                        ...(task.dateDue && { DateDue: task.dateDue }),
                        Description: task.description,
                        Duration: task.duration,
                        TagsQuantity: task.tagsQuantity || 1,
                        Position: task.position,
                        Completed: task.completed || false
                    },
                    // Without TagsQuantity (common missing field)
                    {
                        OrderNumber: task.orderNumber,
                        Person: person,
                        Date: date,
                        ...(task.dateDue && { DateDue: task.dateDue }),
                        Description: task.description,
                        Duration: task.duration,
                        Position: task.position,
                        Completed: task.completed || false
                    },
                    // Minimal required fields only
                    {
                        OrderNumber: task.orderNumber,
                        Person: person,
                        Date: date,
                        ...(task.dateDue && { DateDue: task.dateDue }),
                        Description: task.description,
                        Duration: task.duration
                    }
                ];

                let lastError = null;
                
                // Try each field set with retry logic
                for (let fieldSetIndex = 0; fieldSetIndex < fieldSets.length; fieldSetIndex++) {
                    const fields = fieldSets[fieldSetIndex];
                    console.log(`🚀 Attempt ${fieldSetIndex + 1}: Trying with field set:`, Object.keys(fields));
                    
                    // Retry each field set up to 3 times for network/temporary errors
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            const data = { records: [{ fields }] };
                            console.log(`🚀 ATTEMPT ${attempt}/3 for field set ${fieldSetIndex + 1}:`, data);
                            
                            const response = await this.makeAirtableRequest(tableName, 'POST', data);
                            const recordId = response.records[0].id;
                            console.log(`✅ FORCE SAVE SUCCESS - Record ID: ${recordId} (Field set ${fieldSetIndex + 1}, Attempt ${attempt})`);
                            
                            // Optional verification - don't fail the save if verification fails
                            try {
                                await this.verifyTaskInAirtable(recordId, {
                                    OrderNumber: task.orderNumber,
                                    Person: person,
                                    Date: date
                                });
                                console.log('✅ Verification passed');
                            } catch (verificationError) {
                                console.warn('⚠️ Verification failed but save was successful:', verificationError.message);
                            }
                            
                            return recordId;
                            
                        } catch (error) {
                            lastError = error;
                            console.warn(`❌ Attempt ${attempt}/3 failed for field set ${fieldSetIndex + 1}:`, error.message);
                            
                            // If it's a field error, don't retry this field set - try the next one
                            if (error.message.includes('Unknown field') || error.message.includes('field')) {
                                console.log(`🔄 Field error detected, trying next field set...`);
                                break; // Break out of retry loop, try next field set
                            }
                            
                            // For network/temporary errors, wait before retrying
                            if (attempt < 3) {
                                console.log(`⏰ Waiting 1 second before retry...`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                    }
                }
                
                // If all attempts failed, throw the last error
                console.error('💥 ALL SAVE ATTEMPTS FAILED after trying all field sets and retries');
                throw new Error(`Failed to save after all attempts: ${lastError?.message || 'Unknown error'}`);
            }
            



            async verifyTaskCreation(recordId, orderNumber) {
                try {
                    console.log('Verifying task creation for record ID:', recordId);
                    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                    const response = await this.makeAirtableRequest(`${tableName}/${recordId}`);
                    console.log('Verification successful - task found in Airtable:', response.fields);
                    
                    if (response.fields.OrderNumber !== orderNumber) {
                        console.warn('Order number mismatch!', {
                            expected: orderNumber,
                            actual: response.fields.OrderNumber
                        });
                    }
                } catch (error) {
                    console.error('Task verification failed:', error);
                    throw new Error(`Task was not properly saved to Airtable: ${error.message}`);
                }
            }
            
            async updateTaskInAirtable(taskId, updates) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                const data = {
                    records: [{
                        id: taskId,
                        fields: updates
                    }]
                };

                await this.makeAirtableRequest(tableName, 'PATCH', data);
                
                // Verify the update was successful
                await this.verifyTaskInAirtable(taskId, updates);
            }
            
            async deleteTaskFromAirtable(taskId) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.tasks);
                await this.makeAirtableRequest(`${tableName}/${taskId}`, 'DELETE');
                
                // Verify the deletion was successful
                await this.verifyTaskDeletion(taskId);
            }
            
            async loadTextContentFromAirtable() {
                try {
                    const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.people);
                    const filterFormula = `{Name}='__TEXT_CONTENT__'`;
                    const response = await this.makeAirtableRequest(`${tableName}?filterByFormula=${encodeURIComponent(filterFormula)}`);
                    
                    if (response.records.length > 0) {
                        const textContent = response.records[0].fields.TextContent || '';
                        this.customTextContent = textContent;
                        await this.saveTextContentLocally(textContent);
                    } else {
                        this.customTextContent = '';
                    }
                } catch (error) {
                    console.warn('Could not load text content from Airtable:', error);
                    this.customTextContent = await this.getEditTextContent();
                }
            }

            async loadEditTextContent() {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('edit-text-content');
                        request.onsuccess = () => {
                            const result = request.result;
                            const textArea = document.getElementById('editableTextArea');
                            let content = '';
                            
                            if (result && result.content) {
                                content = result.content;
                            } else if (this.customTextContent) {
                                content = this.customTextContent;
                            }
                            
                            if (textArea) {
                                textArea.value = content;
                            }
                            
                            resolve(content);
                        };
                        request.onerror = () => {
                            const textArea = document.getElementById('editableTextArea');
                            if (textArea && this.customTextContent) {
                                textArea.value = this.customTextContent;
                            }
                            resolve(this.customTextContent || '');
                        };
                    });
                } catch (error) {
                    console.warn('Could not load edit text content:', error);
                    const textArea = document.getElementById('editableTextArea');
                    if (textArea && this.customTextContent) {
                        textArea.value = this.customTextContent;
                    }
                    return this.customTextContent || '';
                }
            }

            async saveEditText() {
                const textArea = document.getElementById('editableTextArea');
                const content = textArea.value;
                
                this.customTextContent = content;

                if (this.airtableConfig.apiKey && this.airtableConfig.baseId) {
                    this.showLoading('Saving text...');
                    try {
                        await this.saveTextContentToAirtable(content);
                        this.showSuccessToast('sync', 'Text');
                    } catch (error) {
                        this.showToast(`Failed to sync text: ${error.message}`, 'warning');
                        await this.saveTextContentLocally(content);
                        return;
                    } finally {
                        this.hideLoading();
                    }
                } else {
                    this.showToast('Text saved locally! Connect to Airtable to sync.', 'info');
                }

                await this.saveTextContentLocally(content);
            }
            
            async saveTextContentToAirtable(content) {
                const tableName = encodeURIComponent(this.airtableConfig.tablesConfig.people);
                
                const filterFormula = `{Name}='__TEXT_CONTENT__'`;
                const response = await this.makeAirtableRequest(`${tableName}?filterByFormula=${encodeURIComponent(filterFormula)}`);
                
                const textRecord = {
                    Name: '__TEXT_CONTENT__',
                    Active: false,
                    TextContent: content
                };
                
                if (response.records.length > 0) {
                    const recordId = response.records[0].id;
                    const data = {
                        records: [{
                            id: recordId,
                            fields: textRecord
                        }]
                    };
                    await this.makeAirtableRequest(tableName, 'PATCH', data);
                } else {
                    const data = {
                        records: [{ fields: textRecord }]
                    };
                    await this.makeAirtableRequest(tableName, 'POST', data);
                }
            }
            
            async saveTextContentLocally(content) {
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readwrite');
                    const store = transaction.objectStore('config');
                    
                    const textData = {
                        id: 'edit-text-content',
                        content: content,
                        lastSaved: new Date().toISOString()
                    };
                    
                    await new Promise((resolve, reject) => {
                        const request = store.put(textData);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn('Could not save edit text content locally:', error);
                    throw error;
                }
            }

            clearEditText() {
                const textArea = document.getElementById('editableTextArea');
                textArea.value = '';
                textArea.focus();
            }

            async getEditTextContent() {
                if (this.customTextContent !== undefined) {
                    return this.customTextContent;
                }
                
                try {
                    const db = await this.openConfigDatabase();
                    const transaction = db.transaction(['config'], 'readonly');
                    const store = transaction.objectStore('config');
                    
                    return new Promise((resolve) => {
                        const request = store.get('edit-text-content');
                        request.onsuccess = () => {
                            const result = request.result;
                            resolve(result ? result.content : '');
                        };
                        request.onerror = () => resolve('');
                    });
                } catch (error) {
                    return '';
                }
            }
            async loadAndDisplayCustomText() {
                const content = await this.getEditTextContent();
                const display = document.getElementById('customTextDisplay');
                const contentDiv = document.getElementById('customTextContent');
                
                if (content && content.trim()) {
                    contentDiv.textContent = content;
                    display.style.display = 'block';
                } else {
                    contentDiv.textContent = 'No reference text configured. Add text in Settings > Edit Text.';
                    display.style.display = 'block';
                }
            }
// Add this method to your TaskSchedulerApp class
// Add this method to cache frequently used elements
getElement(id) {
    if (!this.elementCache) {
        this.elementCache = new Map();
    }
    
    if (!this.elementCache.has(id)) {
        this.elementCache.set(id, document.getElementById(id));
    }
    
    return this.elementCache.get(id);
}

// Clear cache when needed
clearElementCache() {
    if (this.elementCache) {
        this.elementCache.clear();
    }
}


dateUtils = {
    format: (date, format = 'display') => {
        if (!date) return '';
        const d = this.parseDateString(date);
        if (!d) return 'Invalid Date';
        
        switch(format) {
            case 'input': return d.toISOString().split('T')[0];
            case 'local': return this.dateToLocalDateString(d);
            case 'display': return this.formatDateForDisplay(d);
            case 'relative': return this.getRelativeDate(d);
            default: return d.toLocaleDateString();
        }
    },
    
    isToday: (date) => {
        const today = new Date();
        const d = this.parseDateString(date);
        return d && d.toDateString() === today.toDateString();
    },
    
    isPast: (date) => {
        const d = this.parseDateString(date);
        return d && d < new Date();
    },
    
    daysBetween: (date1, date2) => {
        const d1 = this.parseDateString(date1);
        const d2 = this.parseDateString(date2);
        if (!d1 || !d2) return 0;
        return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    }
};

getRelativeDate(date) {
    const days = this.dateUtils.daysBetween(new Date(), date);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days > 0) return `In ${days} days`;
    return `${Math.abs(days)} days ago`;
}

getStandardMessage(action, type, item = '') {
    const messages = {
        success: {
            save: `✅ ${item} saved successfully!`,
            delete: `🗑️ ${item} deleted!`,
            sync: `🔄 ${item} synced!`,
            connect: '🔗 Connected successfully!',
            update: `📝 ${item} updated!`,
            create: `➕ ${item} created!`
        },
        error: {
            save: '❌ Save failed. Please try again.',
            delete: '❌ Delete failed. Please try again.',
            sync: '❌ Sync failed. Changes saved locally.',
            connect: '❌ Connection failed. Check settings.',
            network: '🌐 Network error. Check connection.',
            validation: '⚠️ Please check your input.'
        },
        warning: {
            offline: '📱 You are offline. Changes saved locally.',
            limit: '⚠️ Approaching limit. Please review.',
            duplicate: '🔄 Duplicate detected. Please verify.'
        }
    };
    
    return messages[type]?.[action] || `${action} ${type}`;
}

showSuccessToast(action, item = '') {
    this.showToast(this.getStandardMessage(action, 'success', item), 'success');
}

showErrorToast(action, error = '') {
    this.showToast(this.getStandardMessage(action, 'error', error), 'error');
}

handleModalAction(modalId, action) {
    const modal = document.getElementById(modalId);
    
    if (action === 'show') {
        modal.classList.remove('hidden');
    } else if (action === 'hide') {
        modal.classList.add('hidden');
        if (modalId === 'orderModal') {
            this.resetOrderModal();
        }
    }
}

resetModalState(modalId) {
    // Only reset order modal state to avoid breaking other modals
    if (modalId === 'orderModal') {
        this.isEditingTask = false;
        this.editingTaskId = null;
        this.originalTaskData = null;
    }
}

resetModalState(modalId) {
    const modal = document.getElementById(modalId);
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());
    
    if (modalId === 'orderModal') {
        this.isEditingTask = false;
        this.editingTaskId = null;
        this.originalTaskData = null;
    }
}

validateField(value, rules) {
    const errors = [];
    
    rules.forEach(rule => {
        switch(rule.type) {
            case 'required':
                if (!value || value.trim().length === 0) {
                    errors.push(rule.message || 'This field is required');
                }
                break;
            case 'minLength':
                if (value && value.length < rule.value) {
                    errors.push(rule.message || `Minimum ${rule.value} characters required`);
                }
                break;
            case 'maxLength':
                if (value && value.length > rule.value) {
                    errors.push(rule.message || `Maximum ${rule.value} characters allowed`);
                }
                break;
            case 'range':
                const num = parseInt(value);
                if (num < rule.min || num > rule.max) {
                    errors.push(rule.message || `Value must be between ${rule.min} and ${rule.max}`);
                }
                break;
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

handleBackOnline() {
    if (this.retryQueue && this.retryQueue.length > 0) {
        console.log(`Attempting to sync ${this.retryQueue.length} pending changes`);
        this.retryQueue.forEach(operation => {
            this.safeExecute(operation);
        });
        this.retryQueue = [];
    }
}

handleProductionError(error, context = '') {
    this.errorCount = (this.errorCount || 0) + 1;
    console.error(`[${context}] Error #${this.errorCount}:`, error);
    
    if (error.message.includes('Airtable')) {
        this.showErrorToast('sync');
    } else if (error.message.includes('Network')) {
        this.showErrorToast('network');
    } else {
        this.showErrorToast('validation', 'Something went wrong. Please refresh if issues persist.');
    }
}

performanceTrack(name, operation) {
    const startTime = performance.now();
    try {
        const result = operation();
        const endTime = performance.now();
        if (endTime - startTime > 100) {
            console.log(`⚡ ${name}: ${(endTime - startTime).toFixed(2)}ms`);
        }
        return result;
    } catch (error) {
        console.error(`❌ ${name} failed:`, error);
        throw error;
    }
}

validateOrderData(orderNumber, dateDue, description, duration) {
    const validations = [
        {
            value: orderNumber,
            rules: [
                { type: 'required', message: 'Order number is required' },
                { type: 'minLength', value: 2 },
                { type: 'maxLength', value: 50 }
            ]
        },
     //   {
     //       value: dateDue,
     //       rules: [
     //           { type: 'required', message: 'Due date is required' }
     //       ]
     //   },
        {
            value: description,
            rules: [
                { type: 'required', message: 'Description is required' },
                { type: 'minLength', value: 3 },
                { type: 'maxLength', value: 500 }
            ]
        },
        {
            value: duration,
            rules: [
                { type: 'range', min: 1, max: 32, message: 'Duration must be between 1 and 32 slots' }
            ]
        }
    ];

    const allErrors = [];
    
    validations.forEach(validation => {
        const result = this.validateField(validation.value, validation.rules);
        if (!result.isValid) {
            allErrors.push(...result.errors);
        }
    });

    return {
        isValid: allErrors.length === 0,
        errors: allErrors
    };
}

initOfflineDetection() {
    window.addEventListener('online', () => {
        this.showToast('Connection restored! Syncing data...', 'success');
        this.handleBackOnline();
    });
    
    window.addEventListener('offline', () => {
        this.showToast('You are offline. Changes will be saved locally.', 'warning');
    });
}


debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

safeExecute(operation, fallback = null) {
    try {
        return operation();
    } catch (error) {
        console.error('Operation failed:', error);
        this.showErrorToast('validation', 'Operation failed. Please try again.');
        return fallback;
    }
}

sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Add this method to cache frequently used elements
getElement(id) {
    if (!this.elementCache) {
        this.elementCache = new Map();
    }
    
    if (!this.elementCache.has(id)) {
        this.elementCache.set(id, document.getElementById(id));
    }
    
    return this.elementCache.get(id);
}

// Clear cache when needed
clearElementCache() {
    if (this.elementCache) {
        this.elementCache.clear();
    }
}

cleanup() {
    // Clear intervals
    if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
    }
    
    // Clear caches
    this.clearElementCache();
    
    // Clear event listeners
    if (this.eventListeners) {
        this.eventListeners.forEach((listeners, elementId) => {
            const element = document.getElementById(elementId);
            if (element) {
                listeners.forEach(({ event, handler }) => {
                    element.removeEventListener(event, handler);
                });
            }
        });
        this.eventListeners.clear();
    }
    
    console.log('🧹 App cleanup completed');
}
        }

        // Initialize the application
        const app = new TaskSchedulerApp();
