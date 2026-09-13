document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    const currentMonthDisplay = document.getElementById('current-month-display');
    const calendarDays = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const todayBtn = document.getElementById('today-btn');

    const taskPanel = document.getElementById('task-panel');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const taskList = document.getElementById('task-list');
    const newTaskInput = document.getElementById('new-task-input');
    const addTaskBtn = document.getElementById('add-task-btn');

    // KVDB API Endpoint
    const KVDB_URL = 'https://kvdb.io/XwVvu5y682869iBYPGKHfJ/calendar';

    // State
    let currentDate = new Date(); // Date used for navigating months
    let selectedDate = null; // YYYY-MM-DD string
    let tasks = []; // Array of all tasks
    let aesKey = null;

    // Check if we already logged in during this session
    checkAuth();

    // Login logic
    loginBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) return;
        
        // Let's test the password by fetching the DB and trying to decrypt
        try {
            const res = await fetch(KVDB_URL);
            if (!res.ok) {
                // If the DB doesn't exist yet, we initialize it
                if (password === '0923') {
                    aesKey = password;
                    sessionStorage.setItem('aesKey', aesKey);
                    await initializeDB();
                    showApp();
                } else {
                    loginError.textContent = '密碼錯誤 (初始設定)';
                }
                return;
            }

            const data = await res.json();
            
            // If data is stored plainly (from previous test), upgrade it
            if (data.tasks) {
                if (password === '0923') {
                    aesKey = password;
                    sessionStorage.setItem('aesKey', aesKey);
                    tasks = data.tasks;
                    await saveTasks(); // Re-save with encryption
                    showApp();
                    return;
                }
            }
            
            if (data.encrypted) {
                try {
                    const bytes = CryptoJS.AES.decrypt(data.encrypted, password);
                    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                    
                    if (decryptedData && Array.isArray(decryptedData.tasks)) {
                        aesKey = password;
                        sessionStorage.setItem('aesKey', aesKey);
                        tasks = decryptedData.tasks;
                        showApp();
                    } else {
                        loginError.textContent = '密碼錯誤';
                    }
                } catch (e) {
                    loginError.textContent = '密碼錯誤';
                }
            } else {
                // Empty or corrupted
                if (password === '0923') {
                    aesKey = password;
                    sessionStorage.setItem('aesKey', aesKey);
                    await initializeDB();
                    showApp();
                } else {
                    loginError.textContent = '密碼錯誤';
                }
            }
        } catch (err) {
            loginError.textContent = '網路錯誤，無法驗證密碼';
            console.error(err);
        }
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    function checkAuth() {
        const storedAesKey = sessionStorage.getItem('aesKey');
        if (storedAesKey) {
            aesKey = storedAesKey;
            fetchTasks().then(success => {
                if (success) {
                    showApp();
                } else {
                    showLogin();
                }
            });
        } else {
            showLogin();
        }
    }

    function showLogin() {
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }

    function showApp() {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Jump to current day
        currentDate = new Date();
        const todayStr = formatDateStr(currentDate);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        selectDate(todayStr);
    }

    // Calendar logic
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });

    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        selectDate(formatDateStr(currentDate));
    });

    function renderCalendar(year, month) {
        currentMonthDisplay.textContent = `${year}年 ${month + 1}月`;
        calendarDays.innerHTML = '';
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const startingDay = firstDay.getDay(); 
        const totalDays = lastDay.getDate();
        
        const today = new Date();
        const todayStr = formatDateStr(today);

        // Fill empty days
        for (let i = 0; i < startingDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'day empty';
            calendarDays.appendChild(emptyDiv);
        }

        // Fill days
        for (let i = 1; i <= totalDays; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day';
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            if (dateStr === todayStr) {
                dayDiv.classList.add('today');
            }
            if (dateStr === selectedDate) {
                dayDiv.classList.add('selected');
            }
            
            const numSpan = document.createElement('div');
            numSpan.className = 'date-num';
            numSpan.textContent = i;
            dayDiv.appendChild(numSpan);
            
            const hasTasks = tasks.some(t => t.date === dateStr);
            if (hasTasks) {
                const dot = document.createElement('div');
                dot.className = 'task-dot';
                dayDiv.appendChild(dot);
            }
            
            dayDiv.addEventListener('click', () => selectDate(dateStr));
            calendarDays.appendChild(dayDiv);
        }
    }

    function selectDate(dateStr) {
        selectedDate = dateStr;
        
        document.querySelectorAll('.day').forEach(el => {
            el.classList.remove('selected');
        });
        
        const year = parseInt(dateStr.split('-')[0]);
        const month = parseInt(dateStr.split('-')[1]) - 1;
        const day = parseInt(dateStr.split('-')[2]);
        
        if (currentDate.getFullYear() !== year || currentDate.getMonth() !== month) {
            currentDate = new Date(year, month, 1);
            renderCalendar(year, month);
        }
        highlightSelectedDay(day);
        
        taskPanel.classList.remove('hidden');
        selectedDateDisplay.textContent = `${year}年${month + 1}月${day}日 行程`;
        renderTasksForDate(dateStr);
    }

    function highlightSelectedDay(day) {
        const days = document.querySelectorAll('.day:not(.empty)');
        if (days[day - 1]) {
            days[day - 1].classList.add('selected');
        }
    }

    // KVDB API Logic
    async function fetchTasks() {
        try {
            const res = await fetch(KVDB_URL);
            if (!res.ok) return false;
            
            const data = await res.json();
            if (data.encrypted) {
                try {
                    const bytes = CryptoJS.AES.decrypt(data.encrypted, aesKey);
                    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                    if (decryptedData && Array.isArray(decryptedData.tasks)) {
                        tasks = decryptedData.tasks;
                        return true;
                    }
                } catch(e) {
                    return false;
                }
            } else if (data.tasks) {
                tasks = data.tasks;
                return true;
            }
            return false;
        } catch (err) {
            console.error('Failed to fetch tasks', err);
            return false;
        }
    }

    async function saveTasks() {
        try {
            // Encrypt data before saving
            const plainJson = JSON.stringify({ tasks });
            const ciphertext = CryptoJS.AES.encrypt(plainJson, aesKey).toString();
            
            await fetch(KVDB_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encrypted: ciphertext })
            });
            // Update calendar dots if needed
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        } catch (err) {
            console.error('Failed to save tasks', err);
            alert('儲存失敗，請檢查網路連線');
        }
    }

    async function initializeDB() {
        tasks = [
            { id: 1, date: "2026-09-14", description: "早上要去萬家福拿貨", is_done: 0 },
            { id: 2, date: "2026-09-14", description: "LUCKY的雞胸肉快到期要記得煮", is_done: 0 },
            { id: 3, date: "2026-09-14", description: "冰箱還有滷雞塊", is_done: 0 },
            { id: 4, date: "2026-09-14", description: "要收垃圾倒垃圾", is_done: 0 }
        ];
        await saveTasks();
    }

    function renderTasksForDate(dateStr) {
        taskList.innerHTML = '';
        const dayTasks = tasks.filter(t => t.date === dateStr);
        
        if (dayTasks.length === 0) {
            taskList.innerHTML = '<p style="color: #888; padding: 10px;">目前沒有行程</p>';
            return;
        }
        
        dayTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = `task-item ${task.is_done ? 'done' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.is_done === 1;
            checkbox.addEventListener('change', async () => {
                task.is_done = checkbox.checked ? 1 : 0;
                item.className = `task-item ${task.is_done ? 'done' : ''}`;
                await saveTasks(); // Sync to cloud
            });
            
            const text = document.createElement('span');
            text.textContent = task.description;
            
            item.appendChild(checkbox);
            item.appendChild(text);
            taskList.appendChild(item);
        });
    }

    addTaskBtn.addEventListener('click', async () => {
        const desc = newTaskInput.value.trim();
        if (!desc || !selectedDate) return;
        
        const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        tasks.push({
            id: newId,
            date: selectedDate,
            description: desc,
            is_done: 0
        });
        
        newTaskInput.value = '';
        await saveTasks();
        renderTasksForDate(selectedDate);
    });

    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTaskBtn.click();
    });

    // Utils
    function formatDateStr(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
});
