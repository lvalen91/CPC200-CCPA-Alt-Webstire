// Main Application Logic for CPC200-CCPA Web Interface

const App = {
    settings: {},
    boxInfo: {},
    deviceList: [],
    statsInterval: null,
    lastRx: 0,
    lastTx: 0,

    // Initialize application
    init: function() {
        console.log('[App] init called');
        this.setupTabs();
        this.setupToggles();
        this.setupRangeInputs();
        console.log('[App] Setup complete, calling loadData');
        this.loadData();

        // Refresh settings every 30 seconds
        setInterval(() => this.loadData(), 30000);

        // Auto-start system stats refresh (every 2 seconds)
        this.updateStats();
        this.statsInterval = setInterval(() => this.updateStats(), 2000);
    },

    // Tab navigation
    setupTabs: function() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
    },

    // Toggle button groups
    setupToggles: function() {
        document.querySelectorAll('.toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                var key = toggle.dataset.key;
                var val = toggle.dataset.value;
                this.setToggle(key, val, toggle);
            });
        });
    },

    // Range input handlers
    setupRangeInputs: function() {
        var naviVolume = document.getElementById('naviVolume');
        if (naviVolume) {
            naviVolume.addEventListener('input', function() {
                document.getElementById('naviVolumeValue').textContent = this.value;
            });
            naviVolume.addEventListener('change', function() {
                App.setSelect('naviVolume', this.value);
            });
        }
    },

    // Load all data from device
    loadData: function() {
        console.log('[App] loadData called');
        API.getInfos((err, data) => {
            console.log('[App] getInfos callback - err:', err, 'data:', data);
            if (err) {
                console.error('[App] Error loading data:', err);
                this.toast('Failed to load data', 'error');
                return;
            }
            if (data) {
                console.log('[App] Data received - Settings:', data.Settings);
                console.log('[App] Data received - BoxInfo:', data.BoxInfo);
                console.log('[App] Data received - DevList:', data.DevList);
                // API returns data directly (not wrapped in data.data)
                this.settings = data.Settings || {};
                this.boxInfo = data.BoxInfo || {};
                this.deviceList = data.DevList || [];
                this.wifiChannelList = data.WifiChannelList || [];

                // Fetch additional settings from riddle.conf that aren't in infos response
                this.loadExtendedConfig();
            } else {
                console.warn('[App] No data received');
            }
        });
    },

    // Load extended config settings not returned by infos API
    loadExtendedConfig: function() {
        fetch('/cgi-bin/config.cgi')
            .then(r => r.json())
            .then(config => {
                console.log('[App] Extended config loaded:', config);
                // Merge extended config into settings (config values take precedence for these keys)
                var extendedKeys = [
                    'MicType', 'BtAudio', 'BackgroundMode', 'HudGPSSwitch',
                    'UDiskPassThrough', 'FastConnect', 'ImprovedFluency',
                    'KnobMode', 'MouseMode', 'AdvancedFeatures', 'CustomCarLogo'
                ];
                extendedKeys.forEach(key => {
                    if (config[key] !== undefined) {
                        this.settings[key] = config[key];
                    }
                });
                console.log('[App] Merged settings:', this.settings);
                this.updateUI();
            })
            .catch(err => {
                console.warn('[App] Could not load extended config:', err);
                // Still update UI with what we have
                this.updateUI();
            });
    },

    // Update UI with loaded data
    updateUI: function() {
        // Update connection status
        this.updateConnectionStatus();

        // Update input fields from Settings
        this.setInputValue('mediaDelay', this.settings.mediaDelay);
        this.setInputValue('echoDelay', this.settings.echoDelay);
        this.setInputValue('ScreenDPI', this.settings.ScreenDPI);
        this.setInputValue('bitRate', this.settings.bitRate);
        this.setInputValue('startDelay', this.settings.startDelay);

        // These are in BoxInfo, not Settings
        this.setInputValue('wifiName', this.boxInfo.wifi || '');
        this.setInputValue('btName', this.boxInfo.bt || '');
        this.setInputValue('boxName', this.boxInfo.boxName || '');

        // Update range inputs
        if (this.settings.naviVolume !== undefined) {
            document.getElementById('naviVolume').value = this.settings.naviVolume;
            document.getElementById('naviVolumeValue').textContent = this.settings.naviVolume;
        }

        // Update select inputs
        this.setSelectValue('wifiChannel', this.settings.wifiChannel);

        // Update toggle states
        this.updateToggles();

        // Update device list
        this.updateDeviceList();

        // Update info tab
        this.updateInfoTab();
    },

    setInputValue: function(id, value) {
        var el = document.getElementById(id);
        if (el && value !== undefined) el.value = value;
    },

    setSelectValue: function(id, value) {
        var el = document.getElementById(id);
        if (el && value !== undefined) el.value = value;
    },

    // Update toggle button states based on settings
    updateToggles: function() {
        // Map HTML data-key to actual API response keys
        // infos API returns: mediaSound, CallQuality, displaySize, autoConn, autoPlay
        // config.cgi returns: MicType, BtAudio, BackgroundMode, HudGPSSwitch, UDiskPassThrough,
        //                     FastConnect, ImprovedFluency, KnobMode, MouseMode, AdvancedFeatures, CustomCarLogo
        var s = this.settings;
        var mappings = {
            'mediaSound': s.mediaSound,
            'callQuality': s.CallQuality,
            'micType': s.MicType,
            'BtAudio': s.BtAudio,
            'displaySize': s.displaySize,
            'mouseMode': s.MouseMode,
            'KnobMode': s.KnobMode,
            'bgMode': s.BackgroundMode,
            'ImprovedFluency': s.ImprovedFluency,
            'autoConn': s.autoConn,
            'autoPlay': s.autoPlay,
            'FastConnect': s.FastConnect,
            'gps': s.HudGPSSwitch,
            'Udisk': s.UDiskPassThrough,
            'AdvancedFeatures': s.AdvancedFeatures,
            'customCarLogo': s.CustomCarLogo
        };

        console.log('[App] updateToggles - Settings keys:', Object.keys(this.settings));
        console.log('[App] updateToggles - Mapped values:', mappings);

        document.querySelectorAll('.toggle').forEach(toggle => {
            var key = toggle.dataset.key;
            var val = toggle.dataset.value;
            if (mappings[key] !== undefined && mappings[key].toString() === val) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        });

        // Show/hide logo upload based on customCarLogo
        var logoSection = document.getElementById('logoUploadSection');
        if (logoSection) {
            logoSection.style.display = this.settings.customCarLogo ? 'block' : 'none';
        }
    },

    // Update connection status display
    updateConnectionStatus: function() {
        var statusEl = document.getElementById('connectionStatus');
        var bigStatusEl = document.getElementById('bigStatus');
        var phoneInfoEl = document.getElementById('phoneInfo');
        var dot = statusEl.querySelector('.status-dot');
        var text = statusEl.querySelector('.status-text');

        var linkType = this.boxInfo.MDLinkType || '';
        var model = this.boxInfo.MDModel || '';

        // Find device name from deviceList matching the connection type
        var deviceName = '';
        if (linkType && this.deviceList && this.deviceList.length > 0) {
            var matchedDevice = this.deviceList.find(d => d.type === linkType);
            if (matchedDevice) {
                deviceName = matchedDevice.name || '';
            }
        }

        if (linkType) {
            dot.className = 'status-dot connected';
            text.textContent = linkType;
            bigStatusEl.textContent = linkType;
            bigStatusEl.className = 'big-status connected';
            // Show device name, model, and OS version
            var info = [];
            if (deviceName) info.push(deviceName);
            if (model) info.push(model);
            if (this.boxInfo.MDOSVersion) info.push('iOS ' + this.boxInfo.MDOSVersion);
            phoneInfoEl.textContent = info.join(' | ');
        } else {
            dot.className = 'status-dot';
            text.textContent = 'Disconnected';
            bigStatusEl.textContent = 'Disconnected';
            bigStatusEl.className = 'big-status';
            phoneInfoEl.textContent = '';
        }
    },

    // Update device list
    updateDeviceList: function() {
        var container = document.getElementById('deviceList');
        if (!this.deviceList || this.deviceList.length === 0) {
            container.innerHTML = '<p class="empty">No paired devices</p>';
            return;
        }

        var html = this.deviceList.map(device => {
            return '<div class="device-item">' +
                '<div class="device-info">' +
                '<span class="device-name">' + (device.name || device.id) + '</span>' +
                '<span class="device-type">' + (device.type || 'Unknown') + '</span>' +
                '</div>' +
                '<button class="btn btn-sm btn-danger" onclick="App.deleteDevice(\'' + device.id + '\')">Delete</button>' +
                '</div>';
        }).join('');

        container.innerHTML = html;
    },

    // Update info tab
    updateInfoTab: function() {
        document.getElementById('infoFirmware').textContent = this.boxInfo.ver || '--';
        document.getElementById('infoHardware').textContent = this.boxInfo.hardwareVer || '--';
        document.getElementById('infoSerial').textContent = this.boxInfo.uuid || '--';  // Use UUID as serial
        document.getElementById('infoUUID').textContent = this.boxInfo.uuid || '--';
        document.getElementById('infoProduct').textContent = this.boxInfo.productType || '--';
        document.getElementById('infoMfgDate').textContent = this.boxInfo.mfd || '--';
        document.getElementById('infoWifiChannel').textContent = this.settings.wifiChannel || '--';
        document.getElementById('infoBoxIP').textContent = window.location.hostname;
    },

    // Map HTML keys to API keys
    keyMap: {
        'gps': 'HudGPSSwitch',
        'Udisk': 'UDiskPassThrough',
        'callQuality': 'CallQuality',
        'bgMode': 'BackgroundMode',
        'autoConn': 'NeedAutoConnect',
        'autoPlay': 'AutoPlauMusic'  // Note: API has typo "Plau"
    },

    // Set toggle value
    setToggle: function(key, val, element) {
        // Translate key if needed
        var apiKey = this.keyMap[key] || key;

        API.set(apiKey, val, (err, data) => {
            if (err) {
                this.toast('Failed to update setting', 'error');
                return;
            }
            // Update UI
            var group = element.parentElement;
            group.querySelectorAll('.toggle').forEach(t => t.classList.remove('active'));
            element.classList.add('active');
            this.settings[key] = parseInt(val);
            this.toast('Setting updated');

            // Handle special cases
            if (key === 'customCarLogo') {
                document.getElementById('logoUploadSection').style.display = val === '1' ? 'block' : 'none';
            }
        });
    },

    // Set numeric setting from input
    setSetting: function(inputId, key) {
        var value = document.getElementById(inputId).value;
        if (value === '') return;

        API.set(key, value, (err, data) => {
            if (err) {
                this.toast('Failed to update setting', 'error');
                return;
            }
            this.settings[key] = parseInt(value);
            this.toast('Setting updated');
        });
    },

    // Set text setting
    setTextSetting: function(key) {
        var value = document.getElementById(key).value;
        // Sanitize: only allow alphanumeric, spaces, dashes, underscores
        value = value.replace(/[^a-zA-Z0-9\s\-_]/g, '');
        if (value.length > 15) value = value.substring(0, 15);

        API.set(key, value, (err, data) => {
            if (err) {
                this.toast('Failed to update setting', 'error');
                return;
            }
            this.settings[key] = value;
            document.getElementById(key).value = value;
            this.toast('Setting updated');
        });
    },

    // Set select value
    setSelect: function(key, val) {
        API.set(key, val, (err, data) => {
            if (err) {
                this.toast('Failed to update setting', 'error');
                return;
            }
            this.settings[key] = val;
            this.toast('Setting updated');
        });
    },

    // Delete paired device
    deleteDevice: function(deviceId) {
        if (!confirm('Delete device ' + deviceId + '?\n\nNote: A restart is required for changes to take effect.')) return;

        API.deleteDevice(deviceId, (err, data) => {
            if (err) {
                this.toast('Failed to delete device', 'error');
                return;
            }
            this.deviceList = this.deviceList.filter(d => d.id !== deviceId);
            this.updateDeviceList();
            this.toast('Device deleted - restart required to apply changes');

            // Prompt user to restart
            if (confirm('Device deleted. Restart now to apply changes?')) {
                this.restart();
            }
        });
    },

    // Clear all devices
    clearAllDevices: function() {
        if (!confirm('Delete ALL paired devices?\n\nNote: A restart is required for changes to take effect.')) return;

        if (this.deviceList.length === 0) {
            this.toast('No devices to clear');
            return;
        }

        var devicesToDelete = this.deviceList.slice(); // Copy array
        var deletedCount = 0;
        var failedCount = 0;
        var totalDevices = devicesToDelete.length;
        var self = this;

        this.toast('Clearing ' + totalDevices + ' device(s)...');

        // Delete each device individually using the correct 'delDev' parameter
        devicesToDelete.forEach(function(device) {
            API.deleteDevice(device.id, function(err, data) {
                if (err) {
                    failedCount++;
                } else {
                    deletedCount++;
                }

                // Check if all deletions are complete
                if (deletedCount + failedCount === totalDevices) {
                    self.deviceList = [];
                    self.updateDeviceList();

                    if (failedCount > 0) {
                        self.toast('Cleared ' + deletedCount + '/' + totalDevices + ' devices (some failed)', 'error');
                    } else {
                        self.toast('All ' + deletedCount + ' device(s) cleared - restart required');
                    }

                    // Prompt user to restart
                    if (confirm('All devices cleared. Restart now to apply changes?')) {
                        self.restart();
                    }
                }
            });
        });
    },

    // Restart device
    restart: function() {
        if (!confirm('Restart device? This will disconnect any active session.')) return;
        this.doRestart();
    },

    // Restart without confirmation (used after factory reset)
    doRestart: function() {
        this.toast('Restarting device...');
        // Try CGI restart first, fall back to API command
        fetch('/cgi-bin/restart.cgi')
            .catch(() => {
                API.request('restart', null, null, () => {});
            });
    },

    // Factory reset
    factoryReset: function() {
        if (!confirm('FACTORY RESET? This will erase all settings and paired devices!')) return;
        if (!confirm('Are you SURE? This cannot be undone.')) return;

        API.resetApp((err, data) => {
            if (err) {
                this.toast('Reset failed', 'error');
                return;
            }
            this.toast('Factory reset complete');
            if (confirm('Restart device now to apply changes?')) {
                this.doRestart();
            } else {
                this.toast('Restart required for changes to take effect');
                setTimeout(() => this.loadData(), 1000);
            }
        });
    },

    // Reset to previous config
    resetConfig: function() {
        if (!confirm('Reset to previous configuration?')) return;

        API.reset((err, data) => {
            if (err) {
                this.toast('Reset failed', 'error');
                return;
            }
            this.toast('Configuration reset');
            this.loadData();
        });
    },

    // Restore factory defaults
    restoreDefaults: function() {
        if (!confirm('Restore factory default settings?')) return;

        API.request('resetApp', null, null, (err, data) => {
            if (err) {
                this.toast('Restore failed', 'error');
                return;
            }
            this.toast('Defaults restored');
            if (confirm('Restart device now to apply changes?')) {
                this.doRestart();
            } else {
                this.toast('Restart required for changes to take effect');
                setTimeout(() => this.loadData(), 1000);
            }
        });
    },

    // Set CPU governor
    setGovernor: function(governor) {
        fetch('/cgi-bin/governor.cgi', {
            method: 'POST',
            body: governor
        })
        .then(r => r.json())
        .then(data => {
            if (data.current === governor) {
                this.toast('Governor set to ' + governor);
            }
        })
        .catch(() => this.toast('Failed to set governor', 'error'));
    },

    // Download log file
    downloadLog: function(type) {
        var url = '/cgi-bin/logs.cgi?type=' + type;
        var filename = type + '_' + new Date().toISOString().slice(0,10) + '.txt';

        fetch(url)
            .then(r => r.blob())
            .then(blob => {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                this.toast('Downloading ' + filename);
            })
            .catch(() => this.toast('Failed to download log', 'error'));
    },

    // Upload logo
    uploadLogo: function() {
        var fileInput = document.getElementById('logoFile');
        if (!fileInput.files.length) {
            this.toast('Please select a file', 'error');
            return;
        }

        var file = fileInput.files[0];
        if (!file.type.match('image/png')) {
            this.toast('Please select a PNG file', 'error');
            return;
        }

        API.uploadFile(file, 'carlogo.png', (err, data) => {
            if (err) {
                this.toast('Upload failed', 'error');
                return;
            }
            this.toast('Logo uploaded');
        });
    },

    // Update dashboard stats using BoxMonitor API
    updateStats: function() {
        API.getBoxMonitor((err, data) => {
            if (err || !data || !data.BoxMonitor) {
                console.log('[Stats] BoxMonitor error, falling back to sysinfo.cgi');
                this.updateStatsFallback();
                return;
            }
            var m = data.BoxMonitor;

            // Update dashboard stats
            this.setElementText('cpuUsage', Math.round(m.CpuRate) + '%');
            this.setElementText('memUsage', Math.round(m.MemRate) + '%');
            this.setElementText('cpuTemp', Math.round(m.CpuTemp) + '°C');
            this.setElementText('cpuFreq', m.CpuFreq + ' MHz');

            // WiFi throughput from BoxMonitor (already in KB/s)
            this.setElementText('netRxDash', m.WifiRX.toFixed(1) + ' KB/s');
            this.setElementText('netTxDash', m.WifiTX.toFixed(1) + ' KB/s');

            // Projection status
            this.setElementText('projectionType', m.MDLinkType || 'None');
            this.setElementText('huLinkType', m.HULinkType || 'None');

            // Fetch uptime, memory details, and total network stats (not in BoxMonitor)
            fetch('/cgi-bin/sysinfo.cgi')
                .then(r => r.json())
                .then(info => {
                    this.setElementText('uptime', this.formatUptime(info.uptime));
                    this.setElementText('memDetail', info.memUsed + ' / ' + info.memTotal + ' MB');
                    this.setElementText('netRxTotal', 'Total: ' + this.formatBytes(info.rx));
                    this.setElementText('netTxTotal', 'Total: ' + this.formatBytes(info.tx));
                })
                .catch(() => {});
        });
    },

    // Fallback to sysinfo.cgi if BoxMonitor fails
    updateStatsFallback: function() {
        fetch('/cgi-bin/sysinfo.cgi')
            .then(r => r.json())
            .then(data => {
                this.setElementText('cpuUsage', data.cpu + '%');
                this.setElementText('memUsage', data.mem + '%');
                this.setElementText('memDetail', data.memUsed + ' / ' + data.memTotal + ' MB');
                this.setElementText('cpuTemp', data.temp + '°C');
                this.setElementText('uptime', this.formatUptime(data.uptime));
            })
            .catch(() => {});
    },

    // Helper to safely set element text
    setElementText: function(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    // Helper to safely set element style
    setElementStyle: function(id, prop, value) {
        var el = document.getElementById(id);
        if (el) el.style[prop] = value;
    },

    // Refresh WiFi clients
    refreshWifiClients: function() {
        fetch('/cgi-bin/wifi_clients.cgi')
            .then(r => r.json())
            .then(data => {
                var container = document.getElementById('wifiClients');
                if (data.count === 0) {
                    container.innerHTML = '<p>No clients connected</p>';
                } else {
                    container.innerHTML = '<p>' + data.count + ' client(s) connected</p>' +
                        '<ul>' + data.clients.map(c => '<li>' + c + '</li>').join('') + '</ul>';
                }
            })
            .catch(() => {
                document.getElementById('wifiClients').innerHTML = '<p>Failed to load</p>';
            });
    },

    // Format uptime
    formatUptime: function(seconds) {
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        var mins = Math.floor((seconds % 3600) / 60);
        if (days > 0) return days + 'd ' + hours + 'h';
        if (hours > 0) return hours + 'h ' + mins + 'm';
        return mins + 'm';
    },

    // Format bytes
    formatBytes: function(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    // Show toast notification
    toast: function(message, type) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show' + (type === 'error' ? ' error' : '');
        setTimeout(() => toast.className = 'toast', 3000);
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => App.init());
