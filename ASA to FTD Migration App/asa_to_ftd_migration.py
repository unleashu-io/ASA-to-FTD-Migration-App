#!/usr/bin/env python3
"""
ASA to FTD Policy Migration using FMC REST API
FMC: 192.168.11.44 (Version 7.0.5)
Domain: ICS_CTRL_Domain
"""

import requests
import json
import time
import urllib3
from requests.auth import HTTPBasicAuth

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class FMCClient:
    def __init__(self, fmc_ip, username, password):
        self.fmc_ip = fmc_ip
        self.base_url = f"https://{fmc_ip}"
        self.username = username
        self.password = password
        self.auth_token = None
        self.domain_uuid = None
        self.refresh_token = None
        
    def authenticate(self):
        """Get authentication token and domain UUID"""
        url = f"{self.base_url}/api/fmc_platform/v1/auth/generatetoken"
        
        response = requests.post(
            url,
            auth=HTTPBasicAuth(self.username, self.password),
            verify=False
        )
        
        if response.status_code == 204:
            self.auth_token = response.headers.get('X-auth-access-token')
            self.refresh_token = response.headers.get('X-auth-refresh-token')
            
            # Extract domain UUID from headers
            domains = response.headers.get('DOMAINS') or response.headers.get('domains')
            if domains:
                domain_info = json.loads(domains)
                for domain in domain_info:
                    if domain['name'] == 'ICS_CTRL_Domain':
                        self.domain_uuid = domain['uuid']
                        break
                
                if not self.domain_uuid:
                    # Use first domain if ICS_CTRL_Domain not found
                    self.domain_uuid = domain_info[0]['uuid']
                    print(f"Warning: Using domain {domain_info[0]['name']} instead of ICS_CTRL_Domain")
            
            print(f"Authentication successful! Domain UUID: {self.domain_uuid}")
            return True
        else:
            print(f"Authentication failed: {response.status_code} - {response.text}")
            return False
    
    def get_headers(self):
        """Get headers with auth token"""
        return {
            'Content-Type': 'application/json',
            'X-auth-access-token': self.auth_token
        }
    
    def api_call(self, method, endpoint, data=None, params=None):
        """Generic API call wrapper"""
        url = f"{self.base_url}/api/fmc_config/v1/domain/{self.domain_uuid}{endpoint}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.get_headers(),
                json=data,
                params=params,
                verify=False
            )
            
            if response.status_code in [200, 201, 202]:
                return response.json()
            elif response.status_code == 422:
                print(f"Validation error on {endpoint}: {response.text}")
                return None
            else:
                print(f"API call failed: {method} {endpoint} - {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"Exception during API call: {str(e)}")
            return None

def create_network_objects(fmc):
    """Create all network objects from ASA configuration"""
    print("\n=== Creating Network Objects ===")
    
    # Network objects to create
    networks = [
        # Networks
        {"name": "APP-NETWORK-1", "value": "10.2.1.0/24", "type": "Network"},
        {"name": "APP-NETWORK-2", "value": "10.2.0.0/24", "type": "Network"},
        {"name": "SCADA-OPS-NETWORK", "value": "10.3.0.0/24", "type": "Network"},
        {"name": "CTRL-SAFETY-NETWORK", "value": "10.3.1.0/24", "type": "Network"},
        
        # SCADA Server hosts
        {"name": "SCADA-SRV-01", "value": "10.3.0.10", "type": "Host"},
        {"name": "SCADA-SRV-02", "value": "10.3.0.11", "type": "Host"},
        {"name": "SCADA-SRV-03", "value": "10.3.0.12", "type": "Host"},
        {"name": "SCADA-SRV-04", "value": "10.3.0.13", "type": "Host"},
        
        # HMI Workstations
        {"name": "HMI-WS-01", "value": "10.3.0.20", "type": "Host"},
        {"name": "HMI-WS-02", "value": "10.3.0.21", "type": "Host"},
        {"name": "HMI-WS-03", "value": "10.3.0.22", "type": "Host"},
        {"name": "HMI-WS-04", "value": "10.3.0.23", "type": "Host"},
        
        # Engineering Workstations
        {"name": "ENG-WS-01", "value": "10.3.0.30", "type": "Host"},
        {"name": "ENG-WS-02", "value": "10.3.0.31", "type": "Host"},
        
        # Safety Systems
        {"name": "SAFETY-SIS-01", "value": "10.3.1.10", "type": "Host"},
        {"name": "SAFETY-SIS-02", "value": "10.3.1.11", "type": "Host"},
        {"name": "EMERGENCY-SHUTDOWN", "value": "10.3.1.20", "type": "Host"},
        
        # Safety Historians
        {"name": "SAFETY-HIST-01", "value": "10.3.1.30", "type": "Host"},
        {"name": "SAFETY-HIST-02", "value": "10.3.1.31", "type": "Host"},
        
        # Logging and SNMP hosts
        {"name": "SYSLOG-SERVER", "value": "10.3.0.40", "type": "Host"},
        {"name": "SNMP-SERVER", "value": "10.3.0.41", "type": "Host"}
    ]
    
    created_objects = {}
    
    for net_obj in networks:
        response = fmc.api_call('POST', '/objects/networks', data=net_obj)
        if response:
            created_objects[net_obj['name']] = response['id']
            print(f"✓ Created network object: {net_obj['name']}")
        else:
            print(f"✗ Failed to create: {net_obj['name']}")
            
        time.sleep(0.5)  # Rate limiting
    
    return created_objects

def create_port_objects(fmc):
    """Create all port objects from ASA configuration"""
    print("\n=== Creating Port Objects ===")
    
    # Port objects to create
    ports = [
        # SCADA Protocols
        {"name": "Modbus", "port": "502", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "Modbus-UDP", "port": "502", "protocol": "UDP", "type": "ProtocolPortObject"},
        {"name": "DNP3", "port": "20000", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "DNP3-UDP", "port": "20000", "protocol": "UDP", "type": "ProtocolPortObject"},
        {"name": "EtherNet-IP", "port": "44818", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "EtherNet-IP-UDP", "port": "44818", "protocol": "UDP", "type": "ProtocolPortObject"},
        {"name": "IEC-61850", "port": "2404", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "IEC-61850-UDP", "port": "2404", "protocol": "UDP", "type": "ProtocolPortObject"},
        
        # HMI Services
        {"name": "RPC-Endpoint", "port": "135", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "SQL-Server", "port": "1433", "protocol": "TCP", "type": "ProtocolPortObject"},
        
        # Safety Protocols
        {"name": "Safety-Protocol-1", "port": "2222", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "Safety-Protocol-1-UDP", "port": "2222", "protocol": "UDP", "type": "ProtocolPortObject"},
        {"name": "OPC-UA", "port": "4840", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "OPC-UA-UDP", "port": "4840", "protocol": "UDP", "type": "ProtocolPortObject"},
        {"name": "Safety-Protocol-2", "port": "18245", "protocol": "TCP", "type": "ProtocolPortObject"},
        {"name": "Safety-Protocol-2-UDP", "port": "18245", "protocol": "UDP", "type": "ProtocolPortObject"}
    ]
    
    # Port range object
    port_ranges = [
        {"name": "HMI-Custom-Range", "port": "10000-10100", "protocol": "TCP", "type": "PortRange"}
    ]
    
    created_ports = {}
    
    # Create individual port objects
    for port_obj in ports:
        response = fmc.api_call('POST', '/objects/protocolports', data=port_obj)
        if response:
            created_ports[port_obj['name']] = response['id']
            print(f"✓ Created port object: {port_obj['name']}")
        else:
            print(f"✗ Failed to create: {port_obj['name']}")
        time.sleep(0.3)
    
    # Create port range objects
    for range_obj in port_ranges:
        response = fmc.api_call('POST', '/objects/portobjects', data=range_obj)
        if response:
            created_ports[range_obj['name']] = response['id']
            print(f"✓ Created port range: {range_obj['name']}")
        else:
            print(f"✗ Failed to create: {range_obj['name']}")
        time.sleep(0.3)
    
    return created_ports

def create_network_groups(fmc, network_objects):
    """Create network groups using created network objects"""
    print("\n=== Creating Network Groups ===")
    
    groups = [
        {
            "name": "SCADA-SERVERS",
            "objects": ["SCADA-SRV-01", "SCADA-SRV-02", "SCADA-SRV-03", "SCADA-SRV-04"],
            "type": "NetworkGroup"
        },
        {
            "name": "HMI-WORKSTATIONS", 
            "objects": ["HMI-WS-01", "HMI-WS-02", "HMI-WS-03", "HMI-WS-04"],
            "type": "NetworkGroup"
        },
        {
            "name": "ENGINEERING-WORKSTATIONS",
            "objects": ["ENG-WS-01", "ENG-WS-02"],
            "type": "NetworkGroup"
        },
        {
            "name": "SAFETY-SYSTEMS",
            "objects": ["SAFETY-SIS-01", "SAFETY-SIS-02"],
            "type": "NetworkGroup"
        },
        {
            "name": "SAFETY-HISTORIANS",
            "objects": ["SAFETY-HIST-01", "SAFETY-HIST-02"],
            "type": "NetworkGroup"
        }
    ]
    
    created_groups = {}
    
    for group in groups:
        # Build objects list with IDs and types
        objects_list = []
        for obj_name in group['objects']:
            if obj_name in network_objects:
                objects_list.append({
                    "id": network_objects[obj_name],
                    "type": "Network"
                })
        
        group_data = {
            "name": group['name'],
            "type": "NetworkGroup",
            "objects": objects_list
        }
        
        response = fmc.api_call('POST', '/objects/networkgroups', data=group_data)
        if response:
            created_groups[group['name']] = response['id']
            print(f"✓ Created network group: {group['name']}")
        else:
            print(f"✗ Failed to create group: {group['name']}")
        time.sleep(0.5)
    
    return created_groups

def create_port_groups(fmc, port_objects):
    """Create port groups using created port objects"""
    print("\n=== Creating Port Groups ===")
    
    groups = [
        {
            "name": "SCADA-PROTOCOLS-TCP",
            "objects": ["Modbus", "DNP3", "EtherNet-IP", "IEC-61850"],
            "type": "PortObjectGroup"
        },
        {
            "name": "SCADA-PROTOCOLS-UDP", 
            "objects": ["Modbus-UDP", "DNP3-UDP", "EtherNet-IP-UDP", "IEC-61850-UDP"],
            "type": "PortObjectGroup"
        },
        {
            "name": "HMI-SERVICES",
            "objects": ["RPC-Endpoint", "SQL-Server", "HMI-Custom-Range"],
            "type": "PortObjectGroup"
        },
        {
            "name": "SAFETY-PROTOCOLS-TCP",
            "objects": ["Safety-Protocol-1", "OPC-UA", "Safety-Protocol-2"],
            "type": "PortObjectGroup"
        },
        {
            "name": "SAFETY-PROTOCOLS-UDP",
            "objects": ["Safety-Protocol-1-UDP", "OPC-UA-UDP", "Safety-Protocol-2-UDP"],
            "type": "PortObjectGroup"
        }
    ]
    
    created_groups = {}
    
    for group in groups:
        # Build objects list
        objects_list = []
        for obj_name in group['objects']:
            if obj_name in port_objects:
                objects_list.append({
                    "id": port_objects[obj_name],
                    "type": "ProtocolPortObject" if obj_name != "HMI-Custom-Range" else "PortRange"
                })
        
        group_data = {
            "name": group['name'],
            "type": "PortObjectGroup",
            "objects": objects_list
        }
        
        response = fmc.api_call('POST', '/objects/portobjectgroups', data=group_data)
        if response:
            created_groups[group['name']] = response['id']
            print(f"✓ Created port group: {group['name']}")
        else:
            print(f"✗ Failed to create group: {group['name']}")
        time.sleep(0.5)
    
    return created_groups

def create_time_objects(fmc):
    """Create time range objects"""
    print("\n=== Creating Time Objects ===")
    
    time_obj = {
        "name": "MAINTENANCE-WINDOW",
        "type": "TimeRange", 
        "recurring": {
            "recurrenceType": "WEEKLY",
            "daysOfWeek": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            "startTime": {
                "hour": 2,
                "minute": 0
            },
            "endTime": {
                "hour": 4,
                "minute": 0
            }
        }
    }
    
    # Note: FMC API may have different time range format - this is a starting template
    response = fmc.api_call('POST', '/objects/timeranges', data=time_obj)
    if response:
        print(f"✓ Created time object: MAINTENANCE-WINDOW")
        return {time_obj['name']: response['id']}
    else:
        print("✗ Failed to create MAINTENANCE-WINDOW (may need manual creation)")
        return {}

def create_security_zones(fmc):
    """Create security zones"""
    print("\n=== Creating Security Zones ===")
    
    zones = [
        {"name": "FROM-APP", "interfaceMode": "ROUTED", "type": "SecurityZone"},
        {"name": "SCADA-OPS", "interfaceMode": "ROUTED", "type": "SecurityZone"},
        {"name": "CTRL-SAFETY", "interfaceMode": "ROUTED", "type": "SecurityZone"},
        {"name": "MANAGEMENT", "interfaceMode": "ROUTED", "type": "SecurityZone"}
    ]
    
    created_zones = {}
    
    for zone in zones:
        response = fmc.api_call('POST', '/objects/securityzones', data=zone)
        if response:
            created_zones[zone['name']] = response['id']
            print(f"✓ Created security zone: {zone['name']}")
        else:
            print(f"✗ Failed to create zone: {zone['name']}")
        time.sleep(0.3)
    
    return created_zones

def create_access_policy(fmc):
    """Create access control policy"""
    print("\n=== Creating Access Control Policy ===")
    
    policy_data = {
        "name": "ICS-Control-Policy",
        "type": "AccessPolicy",
        "description": "Migrated from ASA ICS-ASA-CTRL-01",
        "defaultAction": {
            "action": "BLOCK",
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        }
    }
    
    response = fmc.api_call('POST', '/policy/accesspolicies', data=policy_data)
    if response:
        print(f"✓ Created access policy: ICS-Control-Policy")
        return response['id']
    else:
        print("✗ Failed to create access policy")
        return None

def create_access_rules(fmc, policy_id, network_objects, network_groups, port_groups, security_zones, port_objects=None):
    """Create access control rules"""
    print("\n=== Creating Access Control Rules ===")
    
    def get_zone_ref(zone_name):
        if zone_name in security_zones:
            return [{"id": security_zones[zone_name], "type": "SecurityZone"}]
        return []
    
    def get_network_ref(obj_name, is_group=False):
        if is_group and obj_name in network_groups:
            return [{"id": network_groups[obj_name], "type": "NetworkGroup"}]
        elif obj_name in network_objects:
            return [{"id": network_objects[obj_name], "type": "Network"}]
        return []
    
    def get_port_ref(port_name):
        if port_name in port_groups:
            return [{"id": port_groups[port_name], "type": "PortObjectGroup"}]
        return []
    
    # Access rules based on ASA configuration
    rules = [
        {
            "name": "App-to-SCADA-HMI",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("FROM-APP")},
            "destinationZones": {"objects": get_zone_ref("SCADA-OPS")},
            "sourceNetworks": {"objects": get_network_ref("APP-NETWORK-1")},
            "destinationNetworks": {"objects": get_network_ref("SCADA-SERVERS", True)},
            "destinationPorts": {"objects": get_port_ref("HMI-SERVICES")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "App-to-SCADA-TCP",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("FROM-APP")},
            "destinationZones": {"objects": get_zone_ref("SCADA-OPS")},
            "sourceNetworks": {"objects": get_network_ref("APP-NETWORK-1")},
            "destinationNetworks": {"objects": get_network_ref("SCADA-SERVERS", True)},
            "destinationPorts": {"objects": get_port_ref("SCADA-PROTOCOLS-TCP")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "App-to-SCADA-UDP",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("FROM-APP")},
            "destinationZones": {"objects": get_zone_ref("SCADA-OPS")},
            "sourceNetworks": {"objects": get_network_ref("APP-NETWORK-1")},
            "destinationNetworks": {"objects": get_network_ref("SCADA-SERVERS", True)},
            "destinationPorts": {"objects": get_port_ref("SCADA-PROTOCOLS-UDP")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "HMI-to-SCADA-Services",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("SCADA-OPS")},
            "destinationZones": {"objects": get_zone_ref("SCADA-OPS")},
            "sourceNetworks": {"objects": get_network_ref("HMI-WORKSTATIONS", True)},
            "destinationNetworks": {"objects": get_network_ref("SCADA-SERVERS", True)},
            "destinationPorts": {"objects": get_port_ref("HMI-SERVICES")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "SCADA-to-Safety-Historians",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("SCADA-OPS")},
            "destinationZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "sourceNetworks": {"objects": get_network_ref("SCADA-SERVERS", True)},
            "destinationNetworks": {"objects": get_network_ref("SAFETY-HISTORIANS", True)},
            "destinationPorts": {"objects": get_port_ref("HMI-SERVICES")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "Safety-to-Historians-TCP",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "destinationZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "sourceNetworks": {"objects": get_network_ref("SAFETY-SYSTEMS", True)},
            "destinationNetworks": {"objects": get_network_ref("SAFETY-HISTORIANS", True)},
            "destinationPorts": {"objects": get_port_ref("SAFETY-PROTOCOLS-TCP")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "Safety-to-Historians-UDP",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "destinationZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "sourceNetworks": {"objects": get_network_ref("SAFETY-SYSTEMS", True)},
            "destinationNetworks": {"objects": get_network_ref("SAFETY-HISTORIANS", True)},
            "destinationPorts": {"objects": get_port_ref("SAFETY-PROTOCOLS-UDP")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "Emergency-Shutdown-Access",
            "action": "ALLOW",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "destinationZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "sourceNetworks": {"objects": get_network_ref("EMERGENCY-SHUTDOWN")},
            "destinationNetworks": {"objects": get_network_ref("SAFETY-HISTORIANS", True)},
            "destinationPorts": {"objects": [{"id": port_objects.get("SQL-Server", ""), "type": "ProtocolPortObject"}]} if port_objects and "SQL-Server" in port_objects else {"objects": []},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "Block-SCADA-to-Safety-Systems",
            "action": "BLOCK",
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("SCADA-OPS")},
            "destinationZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "destinationNetworks": {"objects": get_network_ref("SAFETY-SYSTEMS", True)},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        },
        {
            "name": "Block-SCADA-to-Emergency-Shutdown",
            "action": "BLOCK", 
            "enabled": True,
            "sourceZones": {"objects": get_zone_ref("SCADA-OPS")},
            "destinationZones": {"objects": get_zone_ref("CTRL-SAFETY")},
            "destinationNetworks": {"objects": get_network_ref("EMERGENCY-SHUTDOWN")},
            "logBegin": False,
            "logEnd": True,
            "sendEventsToFMC": True
        }
    ]
    
    created_rules = []
    
    for rule in rules:
        response = fmc.api_call('POST', f'/policy/accesspolicies/{policy_id}/accessrules', data=rule)
        if response:
            created_rules.append(response['id'])
            print(f"✓ Created access rule: {rule['name']}")
        else:
            print(f"✗ Failed to create rule: {rule['name']}")
        time.sleep(0.5)
    
    return created_rules

def get_device_info(fmc):
    """Get FTD device information"""
    print("\n=== Getting Device Information ===")
    
    response = fmc.api_call('GET', '/devices/devicerecords')
    if response:
        devices = {}
        for device in response.get('items', []):
            devices[device['name']] = {
                'id': device['id'],
                'type': device['type']
            }
            print(f"Found device: {device['name']} (ID: {device['id']})")
        return devices
    else:
        print("✗ Failed to retrieve device information")
        return {}

def deploy_to_devices(fmc, device_ids):
    """Deploy configuration to FTD devices"""
    print("\n=== Deploying Configuration ===")
    
    deploy_data = {
        "type": "DeploymentRequest",
        "version": "7.0.5",
        "forceDeploy": False,
        "ignoreWarning": True,
        "deviceList": device_ids
    }
    
    response = fmc.api_call('POST', '/deployment/deploymentrequests', data=deploy_data)
    if response:
        print(f"✓ Deployment initiated. Task ID: {response.get('metadata', {}).get('task', {}).get('id', 'Unknown')}")
        return response
    else:
        print("✗ Failed to initiate deployment")
        return None

def main():
    """Main migration function"""
    print("ASA to FTD Migration using FMC REST API")
    print("=========================================")
    
    # Configuration
    FMC_IP = "192.168.11.44"
    
    # Get credentials
    username = input("Enter FMC username: ")
    password = input("Enter FMC password: ")
    
    # Initialize FMC client
    fmc = FMCClient(FMC_IP, username, password)
    
    # Authenticate
    if not fmc.authenticate():
        print("Authentication failed. Exiting.")
        return
    
    try:
        # Step 1: Create network objects
        network_objects = create_network_objects(fmc)
        
        # Step 2: Create port objects
        port_objects = create_port_objects(fmc)
        
        # Step 3: Create network groups
        network_groups = create_network_groups(fmc, network_objects)
        
        # Step 4: Create port groups
        port_groups = create_port_groups(fmc, port_objects)
        
        # Step 5: Create time objects
        time_objects = create_time_objects(fmc)
        
        # Step 6: Create security zones
        security_zones = create_security_zones(fmc)
        
        # Step 7: Create access policy
        policy_id = create_access_policy(fmc)
        
        if policy_id:
            # Step 8: Create access rules
            access_rules = create_access_rules(fmc, policy_id, network_objects, network_groups, port_groups, security_zones, port_objects)
            
            # Step 9: Get device information
            devices = get_device_info(fmc)
            
            # Step 10: Ask about deployment
            if devices:
                deploy_choice = input(f"\nDeploy to FTD devices? (y/n): ").lower()
                if deploy_choice == 'y':
                    device_ids = [{"id": dev_info['id'], "type": dev_info['type']} for dev_info in devices.values()]
                    deploy_to_devices(fmc, device_ids)
        
        print("\n=== Migration Summary ===")
        print(f"Network Objects: {len(network_objects)} created")
        print(f"Port Objects: {len(port_objects)} created") 
        print(f"Network Groups: {len(network_groups)} created")
        print(f"Port Groups: {len(port_groups)} created")
        print(f"Security Zones: {len(security_zones)} created")
        print(f"Access Rules: {len(access_rules) if 'access_rules' in locals() else 0} created")
        
        if policy_id:
            print(f"\nAccess Policy ID: {policy_id}")
            print("Policy created successfully!")
        
        print("\nNext Steps:")
        print("1. Configure interface IP addresses and security zones via GUI")
        print("2. Configure static routes")
        print("3. Test connectivity between zones")
        print("4. Deploy to devices when ready")
        
    except Exception as e:
        print(f"Migration failed: {str(e)}")

if __name__ == "__main__":
    main()