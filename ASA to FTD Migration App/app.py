from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import json
from asa_to_ftd_migration import FMCClient, create_network_objects, create_port_objects, \
    create_network_groups, create_port_groups, create_time_objects, \
    create_security_zones, create_access_policy, create_access_rules, \
    get_device_info, deploy_to_devices

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/authenticate', methods=['POST'])
def authenticate():
    data = request.json
    fmc_ip = data.get('fmc_ip', '192.168.11.44')
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Username and password required'}), 400
    
    fmc = FMCClient(fmc_ip, username, password)
    if fmc.authenticate():
        session['fmc'] = {
            'fmc_ip': fmc_ip,
            'username': username,
            'password': password,
            'auth_token': fmc.auth_token,
            'domain_uuid': fmc.domain_uuid
        }
        return jsonify({
            'success': True,
            'domain_uuid': fmc.domain_uuid,
            'message': 'Authentication successful'
        })
    else:
        return jsonify({'success': False, 'error': 'Authentication failed'}), 401

@app.route('/api/migrate', methods=['POST'])
def migrate():
    if 'fmc' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    fmc_data = session['fmc']
    fmc = FMCClient(fmc_data['fmc_ip'], fmc_data['username'], fmc_data['password'])
    fmc.auth_token = fmc_data['auth_token']
    fmc.domain_uuid = fmc_data['domain_uuid']
    
    step = request.json.get('step')
    results = {}
    
    try:
        # Get existing migration results from session
        migration_results = session.get('migration_results', {})
        
        if step == 'network_objects':
            results['network_objects'] = create_network_objects(fmc)
        elif step == 'port_objects':
            results['port_objects'] = create_port_objects(fmc)
        elif step == 'network_groups':
            network_objects = migration_results.get('network_objects', {})
            results['network_groups'] = create_network_groups(fmc, network_objects)
        elif step == 'port_groups':
            port_objects = migration_results.get('port_objects', {})
            results['port_groups'] = create_port_groups(fmc, port_objects)
        elif step == 'time_objects':
            results['time_objects'] = create_time_objects(fmc)
        elif step == 'security_zones':
            results['security_zones'] = create_security_zones(fmc)
        elif step == 'access_policy':
            results['policy_id'] = create_access_policy(fmc)
        elif step == 'access_rules':
            results['access_rules'] = create_access_rules(
                fmc,
                migration_results.get('policy_id'),
                migration_results.get('network_objects', {}),
                migration_results.get('network_groups', {}),
                migration_results.get('port_groups', {}),
                migration_results.get('security_zones', {}),
                migration_results.get('port_objects', {})
            )
        elif step == 'get_devices':
            results['devices'] = get_device_info(fmc)
        elif step == 'deploy':
            device_ids = request.json.get('device_ids', [])
            results['deployment'] = deploy_to_devices(fmc, device_ids)
        
        # Store results in session
        if 'migration_results' not in session:
            session['migration_results'] = {}
        session['migration_results'].update(results)
        
        return jsonify({'success': True, 'results': results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/summary', methods=['GET'])
def summary():
    results = session.get('migration_results', {})
    return jsonify({
        'network_objects': len(results.get('network_objects', {})),
        'port_objects': len(results.get('port_objects', {})),
        'network_groups': len(results.get('network_groups', {})),
        'port_groups': len(results.get('port_groups', {})),
        'security_zones': len(results.get('security_zones', {})),
        'access_rules': len(results.get('access_rules', [])),
        'policy_id': results.get('policy_id')
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

