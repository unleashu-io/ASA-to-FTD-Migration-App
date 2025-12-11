let authenticated = false;
let migrationResults = {};

document.getElementById('authBtn').addEventListener('click', authenticate);
document.getElementById('summaryBtn').addEventListener('click', showSummary);
document.getElementById('deployBtn').addEventListener('click', deployDevices);

// Step buttons
document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const step = btn.dataset.step;
        runMigrationStep(step);
    });
});

async function authenticate() {
    const fmcIp = document.getElementById('fmc_ip').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        updateStatus('Please enter username and password', 'error');
        return;
    }
    
    updateStatus('Authenticating...', 'processing');
    
    try {
        const response = await fetch('/api/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fmc_ip: fmcIp, username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authenticated = true;
            updateStatus('Authentication successful!', 'success');
            addLog(`✓ Authenticated successfully. Domain UUID: ${data.domain_uuid}`, 'success');
            document.getElementById('migrationSteps').style.display = 'block';
            document.getElementById('authBtn').disabled = true;
        } else {
            updateStatus('Authentication failed', 'error');
            addLog(`✗ Authentication failed: ${data.error}`, 'error');
        }
    } catch (error) {
        updateStatus('Error during authentication', 'error');
        addLog(`✗ Error: ${error.message}`, 'error');
    }
}

async function runMigrationStep(step) {
    if (!authenticated) {
        updateStatus('Please authenticate first', 'error');
        return;
    }
    
    const btn = document.querySelector(`[data-step="${step}"]`);
    btn.disabled = true;
    updateStatus(`Running ${step}...`, 'processing');
    addLog(`\n=== Running ${step} ===`, 'info');
    
    try {
        const response = await fetch('/api/migrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step })
        });
        
        const data = await response.json();
        
        if (data.success) {
            migrationResults[step] = data.results;
            btn.classList.add('completed');
            updateStatus(`${step} completed`, 'success');
            addLog(`✓ ${step} completed successfully`, 'success');
            
            // Show deploy button after getting devices
            if (step === 'get_devices' && data.results.devices) {
                document.getElementById('deployBtn').style.display = 'block';
            }
        } else {
            updateStatus(`${step} failed`, 'error');
            addLog(`✗ ${step} failed: ${data.error}`, 'error');
        }
    } catch (error) {
        updateStatus('Error', 'error');
        addLog(`✗ Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function showSummary() {
    try {
        const response = await fetch('/api/summary');
        const data = await response.json();
        
        addLog('\n=== Migration Summary ===', 'info');
        addLog(`Network Objects: ${data.network_objects} created`, 'success');
        addLog(`Port Objects: ${data.port_objects} created`, 'success');
        addLog(`Network Groups: ${data.network_groups} created`, 'success');
        addLog(`Port Groups: ${data.port_groups} created`, 'success');
        addLog(`Security Zones: ${data.security_zones} created`, 'success');
        addLog(`Access Rules: ${data.access_rules} created`, 'success');
        if (data.policy_id) {
            addLog(`Access Policy ID: ${data.policy_id}`, 'success');
        }
    } catch (error) {
        addLog(`✗ Error getting summary: ${error.message}`, 'error');
    }
}

async function deployDevices() {
    if (!migrationResults.get_devices || !migrationResults.get_devices.devices) {
        addLog('✗ No devices found. Please run "Get Devices" first.', 'error');
        return;
    }
    
    const deviceIds = Object.values(migrationResults.get_devices.devices).map(dev => ({
        id: dev.id,
        type: dev.type
    }));
    
    updateStatus('Deploying...', 'processing');
    addLog('\n=== Deploying Configuration ===', 'info');
    
    try {
        const response = await fetch('/api/migrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ step: 'deploy', device_ids: deviceIds })
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateStatus('Deployment initiated', 'success');
            addLog('✓ Deployment initiated successfully', 'success');
        } else {
            updateStatus('Deployment failed', 'error');
            addLog(`✗ Deployment failed: ${data.error}`, 'error');
        }
    } catch (error) {
        updateStatus('Error', 'error');
        addLog(`✗ Error: ${error.message}`, 'error');
    }
}

function updateStatus(message, type = '') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

function addLog(message, type = 'info') {
    const output = document.getElementById('output');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
}

