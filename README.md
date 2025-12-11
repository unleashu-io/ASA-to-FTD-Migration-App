# ASA to FTD Migration Web Application

A web-based tool for migrating ASA firewall policies to FTD (Firepower Threat Defense) using the FMC REST API.

## Features

- **Web-based Interface**: Clean, calculator-style UI for easy migration management
- **Step-by-step Migration**: Execute migration steps individually or in sequence
- **Real-time Status**: See progress and results as each step completes
- **Output Logging**: View detailed logs of all operations
- **Device Deployment**: Deploy configurations to FTD devices directly from the web interface

## Installation

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

## Usage

1. **Authenticate**: Enter your FMC IP address, username, and password, then click "Authenticate"

2. **Run Migration Steps**: Click each step button in order:
   - Network Objects
   - Port Objects
   - Network Groups
   - Port Groups
   - Time Objects
   - Security Zones
   - Access Policy
   - Access Rules
   - Get Devices

3. **Deploy**: After getting devices, click "Deploy to Devices" to deploy the configuration

4. **View Summary**: Click "View Summary" to see a summary of all created objects

## Project Structure

```
ASA to FTD Migration App/
├── app.py                      # Flask backend server
├── asa_to_ftd_migration.py     # Migration logic
├── requirements.txt            # Python dependencies
├── templates/
│   └── index.html             # Main web interface
└── static/
    ├── css/
    │   └── style.css          # Stylesheet
    └── js/
        └── main.js            # Frontend JavaScript
```

## Configuration

Default FMC IP: `192.168.11.44`

You can change this in the web interface or modify the default in `app.py`.

## Notes

- The application uses Flask sessions to maintain authentication state
- SSL certificate verification is disabled for self-signed certificates
- Rate limiting is built into the migration functions to avoid API throttling

