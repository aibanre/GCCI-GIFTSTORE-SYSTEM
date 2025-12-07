// Super Admin Management JS
let SUPER_SECRET = '';

function setSecretStatus(msg, ok=true){
  const el = document.getElementById('secretStatus');
  if (el) { 
    el.textContent = msg; 
    el.style.color = '#fff';
    el.style.background = ok ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
    el.style.padding = '0.75rem';
    el.style.borderRadius = '8px';
    el.style.fontWeight = '600';
  }
}

async function fetchAdmins(){
  const tbody = document.getElementById('adminsTableBody');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; color:#469729;"></i><p style="margin:0.5rem 0 0 0;">Loading administrators...</p></td></tr>';
  try {
    const res = await fetch('/super/admins',{ headers: { 'x-superuser-secret': SUPER_SECRET || '' }});
    if(!res.ok) throw new Error('Failed to fetch admins ('+res.status+')');
    const data = await res.json();
    
    // Update statistics
    updateStatistics(data);
    
    const searchTerm = (document.getElementById('adminSearch')?.value || '').trim().toLowerCase();
    const filtered = Array.isArray(data) ? data.filter(a => !searchTerm || a.Username.toLowerCase().includes(searchTerm) || a.Role.toLowerCase().includes(searchTerm)) : [];
    if(filtered.length === 0){
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#666;"><i class="fa-solid fa-users-slash" style="font-size:2rem; opacity:0.3;"></i><p style="margin:0.5rem 0 0 0;">No administrators found.</p></td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td><strong>#${a.AdminID}</strong></td>
        <td><i class="fa-solid fa-user"></i> ${escapeHtml(a.Username)}</td>
        <td><span class="${a.Role === 'superuser' ? 'badge-role badge-role-super' : 'badge-role'}">${escapeHtml(a.Role)}</span></td>
        <td>${a.IsActive ? '<span class="badge-active"><i class="fa-solid fa-check"></i> Active</span>' : '<span class="badge-inactive"><i class="fa-solid fa-times"></i> Inactive</span>'}</td>
        <td><i class="fa-solid fa-clock"></i> ${a.LastLoginAt ? new Date(a.LastLoginAt).toLocaleString() : '<span style="color:#999;">Never</span>'}</td>
        <td><i class="fa-solid fa-calendar"></i> ${a.DateCreated ? new Date(a.DateCreated).toLocaleString() : ''}</td>
        <td class="actions">
          <button class="btn btn-sm btn-warning edit-role-btn" data-id="${a.AdminID}" data-role="${a.Role}" title="Edit Role"><i class="fa-solid fa-user-edit"></i></button>
          <button class="btn btn-sm btn-danger deactivate-admin-btn" data-id="${a.AdminID}" data-active="${a.IsActive}" title="${a.IsActive ? 'Deactivate' : 'Activate'}"><i class="fa-solid fa-${a.IsActive ? 'user-slash' : 'user-check'}"></i></button>
        </td>
      </tr>
    `).join('');
    bindAdminActionButtons();
  } catch(err){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#dc3545;"><i class="fa-solid fa-exclamation-triangle" style="font-size:2rem;"></i><p style="margin:0.5rem 0 0 0;">Error: '+escapeHtml(err.message)+'</p></td></tr>';
  }
}

function updateStatistics(admins) {
  const totalAdmins = admins.length;
  const activeAdmins = admins.filter(a => a.IsActive).length;
  const superUsers = admins.filter(a => a.Role === 'superuser').length;
  
  const totalEl = document.getElementById('totalAdmins');
  const activeEl = document.getElementById('activeAdmins');
  const superEl = document.getElementById('superUsers');
  
  if(totalEl) animateValue(totalEl, 0, totalAdmins, 800);
  if(activeEl) animateValue(activeEl, 0, activeAdmins, 800);
  if(superEl) animateValue(superEl, 0, superUsers, 800);
}

function animateValue(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      element.textContent = end;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 16);
}

function bindAdminActionButtons(){
  document.querySelectorAll('.edit-role-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.getAttribute('data-id'),10);
      const currentRole = btn.getAttribute('data-role');
      const newRole = prompt('Enter new role (admin/superuser):', currentRole);
      if(!newRole || newRole === currentRole) return;
      if(newRole !== 'admin' && newRole !== 'superuser') {
        alert('Invalid role. Must be "admin" or "superuser"');
        return;
      }
      try {
        const res = await fetch('/super/admins/'+id,{ method:'PUT', headers:{ 'Content-Type':'application/json','x-superuser-secret':SUPER_SECRET}, body: JSON.stringify({ Role:newRole })});
        const data = await res.json();
        if(!data.success) throw new Error(data.error || 'Failed');
        alert('Role updated successfully');
        fetchAdmins();
      } catch(err){ alert('Update failed: '+err.message); }
    });
  });
  document.querySelectorAll('.deactivate-admin-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.getAttribute('data-id'),10);
      const isActive = btn.getAttribute('data-active') === 'true';
      const action = isActive ? 'deactivate' : 'activate';
      if(!confirm(`Are you sure you want to ${action} admin ID ${id}?`)) return;
      try {
        const res = await fetch('/super/admins/'+id+'/deactivate',{ method:'PATCH', headers:{ 'x-superuser-secret':SUPER_SECRET }});
        const data = await res.json();
        if(!data.success) throw new Error(data.error || 'Failed');
        alert(`Admin ${action}d successfully`);
        fetchAdmins();
      } catch(err){ alert(`${action.charAt(0).toUpperCase() + action.slice(1)} failed: `+err.message); }
    });
  });
}

function initForms(){
  const createForm = document.getElementById('createAdminForm');
  if(createForm){
    createForm.addEventListener('submit', async e => {
      e.preventDefault();
      if(!SUPER_SECRET){ alert('Please set session secret first.'); return; }
      const Username = document.getElementById('newAdminUsername').value.trim();
      const Password = document.getElementById('newAdminPassword').value;
      const Role = document.getElementById('newAdminRole').value;
      if(!Username || !Password){ alert('Username & Password required'); return; }
      if(Password.length < 6){ alert('Password must be at least 6 characters'); return; }
      try {
        const res = await fetch('/super/admins',{ method:'POST', headers:{ 'Content-Type':'application/json','x-superuser-secret':SUPER_SECRET }, body: JSON.stringify({ Username, Password, Role })});
        const data = await res.json();
        if(!data.success) throw new Error(data.error || 'Failed');
        createForm.reset();
        alert('Admin created successfully');
        fetchAdmins();
      } catch(err){ alert('Create failed: '+err.message); }
    });
  }
  const resetForm = document.getElementById('resetPasswordForm');
  if(resetForm){
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
      if(!SUPER_SECRET){ alert('Please set session secret first.'); return; }
      const adminId = document.getElementById('resetAdminId').value;
      const NewPassword = document.getElementById('resetNewPassword').value;
      if(!adminId || !NewPassword){ alert('Admin ID & New Password required'); return; }
      if(NewPassword.length < 6){ alert('Password must be at least 6 characters'); return; }
      try {
        const res = await fetch('/super/admins/'+adminId+'/password',{ method:'PATCH', headers:{ 'Content-Type':'application/json','x-superuser-secret':SUPER_SECRET }, body: JSON.stringify({ NewPassword })});
        const data = await res.json();
        if(!data.success) throw new Error(data.error || 'Failed');
        resetForm.reset();
        alert('Password reset successfully');
      } catch(err){ alert('Reset failed: '+err.message); }
    });
  }
  const secretForm = document.getElementById('secretForm');
  if(secretForm){
    secretForm.addEventListener('submit', e => {
      e.preventDefault();
      const sec = document.getElementById('sessionSecret').value.trim();
      if(!sec){ setSecretStatus('Secret required', false); return; }
      SUPER_SECRET = sec;
      setSecretStatus('✓ Secret applied successfully - You can now manage admins');
      fetchAdmins();
    });
  }
  const searchInput = document.getElementById('adminSearch');
  if(searchInput){ searchInput.addEventListener('input', fetchAdmins); }
  const refreshBtn = document.getElementById('refreshAdminsBtn');
  if(refreshBtn){ refreshBtn.addEventListener('click', () => {
    fetchAdmins();
    // Add rotation animation to refresh icon
    const icon = refreshBtn.querySelector('i');
    if(icon) {
      icon.style.animation = 'none';
      setTimeout(() => icon.style.animation = 'spin 0.5s linear', 10);
    }
  }); }

  // CSV Upload Form
  const uploadForm = document.getElementById('uploadStudentsForm');
  if(uploadForm){
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('studentsCSV');
      const statusDiv = document.getElementById('uploadStatus');
      const file = fileInput.files[0];
      
      if(!file){
        setUploadStatus('Please select a CSV file', false);
        return;
      }
      
      const formData = new FormData();
      formData.append('csvFile', file);
      
      try {
        setUploadStatus('Uploading and processing...', true, true);
        const res = await fetch('/super/enrolled-students/upload', {
          method: 'POST',
          headers: { 'x-superuser-secret': SUPER_SECRET },
          body: formData
        });
        const data = await res.json();
        
        if(!data.success) throw new Error(data.error || 'Upload failed');
        
        setUploadStatus(`✓ Successfully uploaded ${data.inserted} students! (${data.updated || 0} updated, ${data.errors || 0} errors)`, true);
        uploadForm.reset();
        fetchStudentsCount();
      } catch(err){
        setUploadStatus('Upload failed: ' + err.message, false);
      }
    });
  }

  // Download Template Button
  const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
  if(downloadTemplateBtn){
    downloadTemplateBtn.addEventListener('click', () => {
      const csv = 'student_id;"full_name"\n2021-001;"Juan Dela Cruz"\n2021-002;"Maria Santos"\n2021-003;"Pedro Reyes"';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'enrolled_students_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  // Fetch initial students count
  fetchStudentsCount();
}

function setUploadStatus(msg, ok=true, loading=false){
  const el = document.getElementById('uploadStatus');
  if(el){
    el.textContent = msg;
    el.style.color = '#fff';
    el.style.background = ok ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
    el.style.padding = '0.75rem';
    el.style.borderRadius = '8px';
    el.style.fontWeight = '600';
    el.style.display = 'block';
    
    if(loading){
      el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + msg;
    }
  }
}

async function fetchStudentsCount(){
  try {
    const res = await fetch('/super/enrolled-students/count', {
      headers: { 'x-superuser-secret': SUPER_SECRET }
    });
    const data = await res.json();
    
    if(data.success){
      const countDiv = document.getElementById('studentsCount');
      const countSpan = document.getElementById('totalStudents');
      if(countDiv && countSpan){
        countSpan.textContent = data.count || 0;
        countDiv.style.display = 'block';
      }
    }
  } catch(err){
    console.error('Failed to fetch students count:', err);
  }
}

function escapeHtml(text){
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
  const s = text == null ? '' : String(text);
  return s.replace(/[&<>"']/g, m => map[m]);
}

function initSuperAdmin(){
  initForms();
  // Add spin animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  // initial table fetch deferred until secret set
}

document.addEventListener('DOMContentLoaded', initSuperAdmin);
