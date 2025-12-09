// admin.js
// Initialize Supabase client with your credentials
const SUPABASE_URL = 'https://gwvepxupoxyyydnisulb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dmVweHVwb3h5eXlkbmlzdWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MDE4ODcsImV4cCI6MjA4MDM3Nzg4N30.Ku9SXTAKNMvHilgEpxj5HcVA-0TPt4ziuEq0Irao5Qc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Your OpenCage API key
const OPENCAGE_API_KEY = '0a78fbd8bcd74be398f210b34682c77c';

// Global state
let allReports = [];
let allUsers = [];
let allResponders = [];

// Cache for location names
const locationCache = new Map();

/* ---------------- FETCH RESPONDERS DATA ---------------- */
async function fetchResponders() {
    try {
        console.log("Fetching responders data...");
        
        // First, let's check what tables we have
        const { data: tables, error: tablesError } = await supabase
            .from('reports')
            .select('assigned_responders, assigned_unit, contact')
            .limit(5);
        
        console.log("Sample data from reports table:", tables);
        
        // Fetch responders from the reports table (since they're stored there)
        const { data: reports, error: reportsError } = await supabase
            .from('reports')
            .select('id, assigned_responders, assigned_unit, contact, status, created_at, updated_at')
            .not('assigned_responders', 'is', null)
            .order('created_at', { ascending: false });

        if (reportsError) {
            console.error('Error fetching reports for responders:', reportsError);
            allResponders = [];
            return;
        }

        // Transform report data into responder format
        allResponders = [];
        
        if (reports && reports.length > 0) {
            console.log(`Found ${reports.length} reports with responder data`);
            
            reports.forEach(report => {
                // Skip if no responder data
                if (!report.assigned_responders || report.assigned_responders.trim() === '') {
                    return;
                }
                
                console.log(`Processing report ${report.id}:`, {
                    assigned_responders: report.assigned_responders,
                    assigned_unit: report.assigned_unit,
                    contact: report.contact
                });
                
                // Split multiple responders if they exist
                const responderNames = report.assigned_responders.split(',').map(name => name.trim());
                
                responderNames.forEach((responderName, index) => {
                    const responder = {
                        id: `${report.id}_${index}`,
                        name: responderName,
                        unit: report.assigned_unit || 'Unassigned',
                        contact: report.contact || 'No contact',
                        status: 'Assigned', // Default status
                        report_id: report.id,
                        created_at: report.created_at,
                        updated_at: report.updated_at || report.created_at
                    };
                    
                    allResponders.push(responder);
                });
            });
            
            console.log(`Created ${allResponders.length} responder entries from reports`);
        } else {
            console.log("No reports with responder data found");
            
            // Create some default responders for demonstration
            allResponders = [
                {
                    id: '1',
                    name: 'MDRRMO Unit',
                    unit: 'MDRRMO',
                    contact: '0912-345-6789',
                    status: 'Assigned',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: '2',
                    name: 'BFP Fire Truck',
                    unit: 'BFP',
                    contact: '0917-890-1234',
                    status: 'Assigned',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: '3',
                    name: 'Police Patrol',
                    unit: 'POLICE',
                    contact: '0919-876-5432',
                    status: 'Assigned',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ];
        }
        
        console.log("Final responders data:", allResponders);
        
    } catch (error) {
        console.error('Error in fetchResponders:', error);
        allResponders = [];
    }
}

/* ---------------- FETCH DATA FROM SUPABASE ---------------- */
async function fetchAllData() {
    try {
        // Show loading state
        if (document.getElementById('data-updated')) {
            document.getElementById('data-updated').textContent = 'Loading data...';
        }
        
        console.log("Starting data fetch...");
        
        // Fetch reports from Supabase
        const { data: reports, error: reportsError } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (reportsError) {
            console.error('Error fetching reports:', reportsError);
            allReports = [];
        } else {
            allReports = reports || [];
            console.log(`Fetched ${allReports.length} reports`);
        }

        // Try to fetch users - but don't fail if table doesn't exist
        allUsers = []; // Reset users array
        console.log("Skipping users fetch - no users table found");

        // Fetch responders data
        await fetchResponders();
        console.log(`Fetched ${allResponders.length} responders`);

        // Update UI
        await updateDashboard();
        updateUsersTable();
        await updateReportsTable();
        updateRespondersTable();
        
        // Update timestamp
        const now = new Date();
        if (document.getElementById('data-updated')) {
            document.getElementById('data-updated').textContent = `Last updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
        
        console.log("Data fetch complete");
        
    } catch (error) {
        console.error('Error fetching data:', error);
        if (document.getElementById('data-updated')) {
            document.getElementById('data-updated').textContent = 'Error loading data';
        }
        alert('Error loading data from database. Please check console for details.');
    }
}

/* ---------------- UPDATE DASHBOARD ---------------- */
async function updateDashboard() {
    // Update counts - check if elements exist first
    const totalUsersEl = document.getElementById('total-users');
    const activeReportsEl = document.getElementById('active-reports');
    const availableRespondersEl = document.getElementById('available-responders');
    
    if (totalUsersEl) totalUsersEl.textContent = allUsers.length;
    if (activeReportsEl) activeReportsEl.textContent = allReports.filter(r => 
        r.status === 'pending' || r.status === 'investigating' || r.status === 'submitted'
    ).length;
    
    // Count available responders
    const availableCount = allResponders.filter(r => 
        r.status === 'Available' || r.status === 'available'
    ).length;
    if (availableRespondersEl) availableRespondersEl.textContent = availableCount;
}

/* ---------------- UPDATE USERS TABLE ---------------- */
function updateUsersTable() {
    const usersTbody = document.getElementById('users-table');
    if (!usersTbody) return;
    
    usersTbody.innerHTML = '';

    if (allUsers.length === 0) {
        usersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No users found in database</td></tr>';
        return;
    }

    allUsers.forEach(user => {
        const row = document.createElement('tr');
        
        const userReports = allReports.filter(r => {
            const reporterEmail = r.reporter;
            return (reporterEmail && user.email && reporterEmail === user.email);
        }).length;
        
        const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';
        const userName = user.full_name || user.name || 'Unknown';
        
        row.innerHTML = `
            <td>${userName}</td>
            <td>${user.email || 'No email'}</td>
            <td>${user.role || 'Citizen'}</td>
            <td>${userReports}</td>
            <td>${joinDate}</td>
            <td><button class="btn ghost small" onclick="viewUser('${user.id}')">View</button></td>
        `;
        usersTbody.appendChild(row);
    });
}

/* ---------------- UPDATE REPORTS TABLE ---------------- */
async function updateReportsTable() {
    const reportsTbody = document.getElementById('reports-table');
    if (!reportsTbody) return;
    
    reportsTbody.innerHTML = '';

    if (allReports.length === 0) {
        reportsTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No reports found</td></tr>';
        return;
    }

    // Create rows with geocoding (process in batches to avoid rate limiting)
    const batchSize = 5;
    for (let i = 0; i < allReports.length; i += batchSize) {
        const batch = allReports.slice(i, i + batchSize);
        
        for (const report of batch) {
            const row = document.createElement('tr');
            
            let reporterName = report.reporter || 'Anonymous';
            
            if (typeof reporterName === 'string' && reporterName.includes('@')) {
                const user = allUsers.find(u => u.email === reporterName);
                if (user && (user.full_name || user.name)) {
                    reporterName = user.full_name || user.name || reporterName;
                }
            }

            const time = report.created_at ? new Date(report.created_at).toLocaleString() : 'Unknown';
            const statusClass = getStatusClass(report.status || 'pending');
            const statusText = getStatusText(report.status || 'pending');
            const location = await formatLocation(report); // Await geocoding
            
            row.innerHTML = `
                <td>#${report.id?.toString().padStart(5, '0') || 'N/A'}</td>
                <td>${reporterName}</td>
                <td>${report.type_display || report.type || 'Emergency'}</td>
                <td>${location}</td>
                <td>${time}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn ghost small" onclick="viewReport('${report.id}')">View</button>
                    <button class="btn ghost small" onclick="updateStatus('${report.id}')">Update</button>
                </td>
            `;
            reportsTbody.appendChild(row);
        }
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < allReports.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

/* ---------------- UPDATE RESPONDERS TABLE ---------------- */
function updateRespondersTable() {
    const respondersTbody = document.getElementById('responders-table');
    if (!respondersTbody) {
        console.error("Could not find responders-table element!");
        return;
    }
    
    respondersTbody.innerHTML = '';

    if (allResponders.length === 0) {
        respondersTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No responders found in reports data</td></tr>';
        console.log("No responders data to display");
        return;
    }

    console.log(`Displaying ${allResponders.length} responders in table`);
    
    allResponders.forEach((responder, index) => {
        const row = document.createElement('tr');
        
        const lastUpdated = responder.updated_at ? 
            new Date(responder.updated_at).toLocaleString() : 
            (responder.created_at ? new Date(responder.created_at).toLocaleString() : 'Unknown');
        
        // Determine status badge class
        let statusClass = 'responder-status-assigned'; // Default
        if (responder.status === 'Available' || responder.status === 'available') {
            statusClass = 'responder-status-available';
        } else if (responder.status === 'On Duty') {
            statusClass = 'responder-status-on-duty';
        } else if (responder.status === 'Busy') {
            statusClass = 'responder-status-busy';
        } else if (responder.status === 'On Call') {
            statusClass = 'responder-status-on-call';
        } else if (responder.status === 'Off Duty') {
            statusClass = 'responder-status-off-duty';
        }
        
        const displayStatus = responder.status || 'Assigned';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${responder.name || 'Unknown'}</td>
            <td>${responder.unit || 'Unassigned'}</td>
            <td>${responder.contact || 'No contact'}</td>
            <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
            <td>${lastUpdated}</td>
            <td>
                <button class="btn ghost small" onclick="editResponder('${responder.id}')">Edit</button>
                <button class="btn ghost small" onclick="viewResponderDetails('${responder.id}')">View</button>
            </td>
        `;
        respondersTbody.appendChild(row);
    });
}

/* ---------------- PANEL SWITCH ---------------- */
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.panel').forEach(sec =>
                sec.classList.remove('active')
            );
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Set up refresh button
    document.getElementById('refresh-data').addEventListener('click', fetchAllData);
    
    // Set up export button
    document.getElementById('export').addEventListener('click', () => {
        alert('Export feature coming soon!');
    });
    
    // Set up login button
    document.getElementById('open-login').addEventListener('click', () => {
        document.getElementById('login-modal').style.display = 'block';
    });
    
    // Initial data fetch
    fetchAllData();
    
    // Refresh data every 30 seconds
    setInterval(fetchAllData, 30000);
});

/* ---------------- ADMIN LOGIN SYSTEM ---------------- */
window.closeLogin = function() {
    document.getElementById('login-modal').style.display = 'none';
};

window.adminLogin = function() {
    const u = document.getElementById("admin-user").value;
    const p = document.getElementById("admin-pass").value;

    if (u === "" || p === "") {
        alert("Please enter username and password");
        return;
    }

    // Simple demo login
    if (u === "admin" && p === "1234") {
        alert("Login successful!");
        closeLogin();
    } else {
        alert("Incorrect admin credentials!");
    }
};

/* ---------------- HELPER FUNCTIONS ---------------- */
function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'investigating': 'status-investigating',
        'resolved': 'status-resolved',
        'cancelled': 'status-cancelled',
        'submitted': 'status-pending'
    };
    return statusMap[status] || 'status-pending';
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'investigating': 'Investigating',
        'resolved': 'Resolved',
        'cancelled': 'Cancelled',
        'submitted': 'Submitted'
    };
    return statusMap[status] || 'Pending';
}

/* ---------------- GEOCODING FUNCTION ---------------- */
async function getLocationName(lat, lng) {
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    
    // Return cached result if available
    if (locationCache.has(cacheKey)) {
        return locationCache.get(cacheKey);
    }
    
    try {
        // Use OpenCage Data API
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${OPENCAGE_API_KEY}&language=en&pretty=1&no_annotations=1`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'AidTracker-Admin/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error('No address data returned');
        }
        
        const result = data.results[0];
        const components = result.components;
        
        // Build location name from most specific to general
        let locationParts = [];
        
        // Add specific location parts
        if (components.road) locationParts.push(components.road);
        if (components.village) locationParts.push(components.village);
        if (components.suburb) locationParts.push(components.suburb);
        if (components.neighbourhood) locationParts.push(components.neighbourhood);
        if (components.town) locationParts.push(components.town);
        if (components.city) locationParts.push(components.city);
        if (components.municipality) locationParts.push(components.municipality);
        if (components.state) locationParts.push(components.state);
        if (components.country) locationParts.push(components.country);
        
        let finalAddress = '';
        
        if (locationParts.length > 0) {
            // Remove duplicates while preserving order
            const uniqueParts = [...new Set(locationParts)];
            finalAddress = uniqueParts.join(', ');
        } else if (result.formatted) {
            // Fallback to formatted address
            finalAddress = result.formatted;
        } else {
            // Last resort: return coordinates
            finalAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
        
        // Cache the result
        locationCache.set(cacheKey, finalAddress);
        return finalAddress;
        
    } catch (error) {
        console.warn('Reverse geocoding failed:', error);
        
        // Fallback: Return coordinates
        const fallbackAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        locationCache.set(cacheKey, fallbackAddress);
        return fallbackAddress;
    }
}

/* ---------------- FORMAT LOCATION FUNCTION ---------------- */
async function formatLocation(report) {
    // If location name already exists in database, use it
    if (report.location && report.location.trim() !== '') {
        return report.location;
    }
    
    // If we have coordinates, get location name
    if (report.latitude && report.longitude) {
        try {
            const lat = parseFloat(report.latitude);
            const lng = parseFloat(report.longitude);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                return await getLocationName(lat, lng);
            }
        } catch (error) {
            console.warn(`Could not get address for report ${report.id}:`, error);
        }
    }
    
    // Last resort
    if (report.latitude && report.longitude) {
        return `${parseFloat(report.latitude).toFixed(4)}, ${parseFloat(report.longitude).toFixed(4)}`;
    }
    
    return 'Unknown location';
}

/* ---------------- ADD RESPONDER FUNCTIONS ---------------- */
window.addNewResponder = function() {
    document.getElementById('add-responder-modal').style.display = 'block';
};

window.closeAddResponderModal = function() {
    document.getElementById('add-responder-modal').style.display = 'none';
};

window.saveNewResponder = async function() {
    const name = document.getElementById('responder-name').value.trim();
    const unit = document.getElementById('responder-unit').value.trim();
    const contact = document.getElementById('responder-contact').value.trim();
    const email = document.getElementById('responder-email').value.trim();
    const status = document.getElementById('responder-status').value;
    
    if (!name || !unit || !contact) {
        alert('Please fill in all required fields: Name, Unit, and Contact');
        return;
    }
    
    try {
        // Create a new responder object
        const newResponder = {
            id: Date.now().toString(), // Temporary ID
            name: name,
            unit: unit,
            contact: contact,
            email: email || null,
            status: status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Add to local array
        allResponders.unshift(newResponder);
        
        // Update the table
        updateRespondersTable();
        
        // Close modal
        closeAddResponderModal();
        
        // Clear form
        document.getElementById('responder-name').value = '';
        document.getElementById('responder-unit').value = '';
        document.getElementById('responder-contact').value = '';
        document.getElementById('responder-email').value = '';
        document.getElementById('responder-status').value = 'Assigned';
        
        alert('Responder added successfully!');
        
    } catch (error) {
        console.error('Error adding responder:', error);
        alert('Error adding responder: ' + error.message);
    }
};

/* ---------------- GLOBAL FUNCTIONS ---------------- */
window.viewReport = async function(id) {
    const report = allReports.find(r => r.id == id);
    if (report) {
        let reporterName = report.reporter || 'Anonymous';
        
        if (typeof reporterName === 'string' && reporterName.includes('@')) {
            const user = allUsers.find(u => u.email === reporterName);
            if (user && (user.full_name || user.name)) {
                reporterName = user.full_name || user.name || reporterName;
            }
        }
        
        const location = await formatLocation(report);
        
        // Check if report has responder data
        let responderInfo = '';
        if (report.assigned_responders) {
            responderInfo = `\nAssigned Responders: ${report.assigned_responders}`;
            if (report.assigned_unit) {
                responderInfo += `\nUnit: ${report.assigned_unit}`;
            }
            if (report.contact) {
                responderInfo += `\nContact: ${report.contact}`;
            }
        }
        
        alert(`Report Details:\nID: #${report.id}\nReporter: ${reporterName}\nType: ${report.type_display || report.type}\nLocation: ${location}\nStatus: ${report.status}\nTime: ${new Date(report.created_at).toLocaleString()}${responderInfo}`);
    }
};

window.updateStatus = function(id) {
    const report = allReports.find(r => r.id == id);
    if (!report) {
        alert('Report not found');
        return;
    }
    
    const newStatus = prompt(`Enter new status for report #${id} (pending, investigating, resolved, cancelled):`, report.status || 'pending');
    if (newStatus) {
        supabase
            .from('reports')
            .update({ 
                status: newStatus, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', id)
            .then(({ error }) => {
                if (error) {
                    console.error('Error updating status:', error);
                    alert('Error updating status');
                } else {
                    alert('Status updated successfully');
                    fetchAllData();
                }
            });
    }
};

window.viewUser = function(id) {
    const user = allUsers.find(u => u.id == id);
    if (user) {
        const userReports = allReports.filter(r => {
            const reporterEmail = r.reporter;
            return (reporterEmail && user.email && reporterEmail === user.email);
        }).length;
        
        alert(`User Details:\nName: ${user.full_name || user.name || 'Unknown'}\nEmail: ${user.email || 'No email'}\nRole: ${user.role || 'Citizen'}\nReports Submitted: ${userReports}\nJoined: ${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}`);
    } else {
        alert('User not found');
    }
};

window.editResponder = function(id) {
    const responder = allResponders.find(r => r.id == id);
    if (responder) {
        const newName = prompt(`Edit responder name:`, responder.name || '');
        if (newName !== null) {
            responder.name = newName;
            responder.updated_at = new Date().toISOString();
            alert('Responder updated locally.');
            updateRespondersTable();
        }
    }
};

window.viewResponderDetails = function(id) {
    const responder = allResponders.find(r => r.id == id);
    if (responder) {
        let reportInfo = '';
        if (responder.report_id) {
            const report = allReports.find(r => r.id == responder.report_id);
            if (report) {
                reportInfo = `\nAssigned to Report: #${report.id}\nReport Type: ${report.type_display || report.type}\nReport Status: ${report.status}`;
            }
        }
        
        alert(`Responder Details:\nName: ${responder.name}\nUnit: ${responder.unit}\nContact: ${responder.contact}\nStatus: ${responder.status}\nLast Updated: ${responder.updated_at ? new Date(responder.updated_at).toLocaleString() : 'Unknown'}${reportInfo}`);
    }
};