// Initialize localForage for local database
const db = localforage.createInstance({
    name: "TechSolutions"
});

async function loadInitialData() {
    const response = await fetch('initial-data.json');
    const initialData = await response.json();
    return initialData;
}

async function initDatabase() {
    const initialData = await loadInitialData();
    await db.setItem("users", initialData.users);
    await db.setItem("tasks", initialData.tasks);
    await db.setItem("projects", initialData.projects);
    await db.setItem("activities", initialData.activities);
}

async function setupDatabase() {
    const isInitialized = await db.getItem("isInitialized");
    if (!isInitialized) {
        await initDatabase();
        await db.setItem("isInitialized", true);
    }
}

// DOM elements
const loginForm = document.getElementById("login");
const loginContainer = document.getElementById("login-container");
const appContainer = document.getElementById("app-container");
const userInfo = document.getElementById("user-info");
const mainNav = document.getElementById("main-nav");
const contentArea = document.getElementById("content-area");
const addTaskBtn = document.getElementById("add-task");
const addProjectBtn = document.getElementById("add-project");
const addTeamMemberBtn = document.getElementById("add-team-member");
const taskStatusFilter = document.getElementById("task-status-filter");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalForm = document.getElementById("modal-form");
const closeModal = document.querySelector(".close");

let currentUser = null;

// Login functionality
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const users = await db.getItem("users");
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        currentUser = user;
        loginContainer.classList.add("hidden");
        appContainer.classList.remove("hidden");
        userInfo.innerHTML = `
            <img src="${user.avatar}" alt="${user.name}" class="w-10 h-10 rounded-full mr-2">
            <span class="font-semibold">${user.name}</span>
            <span class="text-sm text-gray-500">(${user.role})</span>
            <button id="logout" class="ml-4 text-red-500 hover:text-red-700">Logout</button>
        `;
        document.getElementById("logout").addEventListener("click", logout);
        updateNavigation();
        loadDashboard();
    } else {
        alert("Invalid username or password");
    }
});

function logout() {
    currentUser = null;
    loginContainer.classList.remove("hidden");
    appContainer.classList.add("hidden");
    userInfo.innerHTML = "";
}

// Update navigation based on user role
function updateNavigation() {
    const navItems = [
        { id: "dashboard", roles: ["admin", "employee"] },
        { id: "tasks", roles: ["admin", "employee"] },
        { id: "projects", roles: ["admin"] },
        { id: "team", roles: ["admin"] }
    ];

    navItems.forEach(item => {
        const navItem = document.querySelector(`nav a[data-section="${item.id}"]`);
        if (item.roles.includes(currentUser.role)) {
            navItem.classList.remove("hidden");
        } else {
            navItem.classList.add("hidden");
        }
    });

    // Update button visibility
    addTaskBtn.style.display = currentUser.role === "admin" ? "block" : "none";
    addProjectBtn.style.display = currentUser.role === "admin" ? "block" : "none";
    addTeamMemberBtn.style.display = currentUser.role === "admin" ? "block" : "none";
}

// Navigation
mainNav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
        e.preventDefault();
        const section = e.target.getAttribute("data-section");
        showSection(section);
    }
});

function showSection(section) {
    const sections = ["dashboard", "tasks", "projects", "team"];
    sections.forEach(s => {
        const sectionElement = document.getElementById(s);
        if (sectionElement) {
            sectionElement.classList.add("hidden");
        }
        const navItem = document.querySelector(`nav a[data-section="${s}"]`);
        if (navItem) {
            navItem.classList.remove("active");
        }
    });
    const currentSection = document.getElementById(section);
    if (currentSection) {
        currentSection.classList.remove("hidden");
    }
    const currentNavItem = document.querySelector(`nav a[data-section="${section}"]`);
    if (currentNavItem) {
        currentNavItem.classList.add("active");
    }

    switch (section) {
        case "dashboard":
            loadDashboard();
            break;
        case "tasks":
            loadTasks();
            break;
        case "projects":
            loadProjects();
            break;
        case "team":
            loadTeam();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    const tasks = await db.getItem("tasks");
    const activities = await db.getItem("activities");
    const projects = await db.getItem("projects");

    // Task overview chart
    const taskStatuses = tasks.reduce((acc, task) => {
        if (currentUser.role === "employee" && task.assignee !== currentUser.id) return acc;
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, {});

    const taskChart = new Chart(document.getElementById("task-chart").getContext("2d"), {
        type: "doughnut",
        data: {
            labels: Object.keys(taskStatuses),
            datasets: [{
                data: Object.values(taskStatuses),
                backgroundColor: ["#10B981", "#F59E0B", "#EF4444"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });

    // Recent activities
    const filteredActivities = currentUser.role === "employee" 
        ? activities.filter(activity => activity.user === currentUser.name)
        : activities;
    document.getElementById("activity-list").innerHTML = filteredActivities.slice(0, 5).map(activity => `
        <li class="mb-2 p-2 bg-gray-100 rounded">
            <span class="font-semibold">${activity.user}</span> ${activity.action} ${activity.item}
            <span class="text-sm text-gray-500 ml-2">${activity.timestamp}</span>
        </li>
    `).join("");

    // Project progress
    if (currentUser.role === "admin") {
        const projectProgress = new Chart(document.getElementById("project-progress").getContext("2d"), {
            type: "bar",
            data: {
                labels: projects.map(project => project.name),
                datasets: [{
                    label: "Completion Percentage",
                    data: projects.map(project => project.completion),
                    backgroundColor: "#3B82F6"
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    } else {
        document.getElementById("project-progress-container").classList.add("hidden");
    }

    // Upcoming deadlines
    const upcomingTasks = tasks.filter(task => {
        if (currentUser.role === "employee" && task.assignee !== currentUser.id) return false;
        return new Date(task.dueDate) > new Date();
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    document.getElementById("deadline-list").innerHTML = upcomingTasks.slice(0, 5).map(task => `
        <li class="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
            <span>${task.title}</span>
            <span class="text-sm text-gray-500">${task.dueDate}</span>
        </li>
    `).join("");
}

// Tasks
async function loadTasks() {
    const tasks = await db.getItem("tasks");
    const users = await db.getItem("users");
    const filteredTasks = currentUser.role === "employee" 
        ? tasks.filter(task => task.assignee === currentUser.id)
        : tasks;
    renderTasks(filteredTasks, users);
}

function renderTasks(tasks, users) {
    const taskList = document.getElementById("task-list");
    taskList.innerHTML = tasks.map(task => `
        <div class="task-card bg-white p-4 rounded-lg shadow-md mb-4">
            <h3 class="text-lg font-semibold mb-2">${task.title}</h3>
            <p class="text-sm text-gray-600">Assignee: ${users.find(user => user.id === task.assignee).name}</p>
            <p class="text-sm text-gray-600">Status: ${task.status}</p>
            <p class="text-sm text-gray-600">Due Date: ${task.dueDate}</p>
            <p class="text-sm text-gray-600">Priority: ${task.priority}</p>
            <div class="mt-2">
                <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full 
                    ${task.priority === 'High' ? 'bg-red-200 text-red-800' : 
                    task.priority === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 
                    'bg-green-200 text-green-800'}">
                    ${task.priority}
                </span>
            </div>
        </div>
    `).join("");
}

addTaskBtn.addEventListener("click", () => showModal("Add Task", createTaskForm));

taskStatusFilter.addEventListener("change", async () => {
    const tasks = await db.getItem("tasks");
    const users = await db.getItem("users");
    let filteredTasks = currentUser.role === "employee" 
        ? tasks.filter(task => task.assignee === currentUser.id)
        : tasks;
    if (taskStatusFilter.value !== "all") {
        filteredTasks = filteredTasks.filter(task => task.status.toLowerCase() === taskStatusFilter.value);
    }
    renderTasks(filteredTasks, users);
});

// Projects
async function loadProjects() {
    const projects = await db.getItem("projects");
    const projectList = document.getElementById("project-list");
    projectList.innerHTML = projects.map(project => `
        <div class="project-card bg-white p-4 rounded-lg shadow-md mb-4">
            <h3 class="text-lg font-semibold mb-2">${project.name}</h3>
            <p class="text-sm text-gray-600">Status: ${project.status}</p>
            <p class="text-sm text-gray-600">Completion: ${project.completion}%</p>
            <div class="mt-2 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${project.completion}%"></div>
            </div>
        </div>
    `).join("");
}

addProjectBtn.addEventListener("click", () => showModal("Add Project", createProjectForm));

// Team
async function loadTeam() {
    const users = await db.getItem("users");
    const teamList = document.getElementById("team-list");
    teamList.innerHTML = users.map(user => `
        <div class="team-card bg-white p-4 rounded-lg shadow-md mb-4 flex items-center">
            <img src="${user.avatar}" alt="${user.name}" class="w-12 h-12 rounded-full mr-4">
            <div>
                <h3 class="text-lg font-semibold">${user.name}</h3>
                <p class="text-sm text-gray-600">Role: ${user.role}</p>
            </div>
        </div>
    `).join("");
}

addTeamMemberBtn.addEventListener("click", () => showModal("Add Team Member", createTeamMemberForm));

// Modal
function showModal(title, formCreator) {
    modalTitle.textContent = title;
    modalForm.innerHTML = "";
    formCreator();
    modal.classList.remove("hidden");
}

function hideModal() {
    modal.classList.add("hidden");
}

closeModal.addEventListener("click", hideModal);

window.addEventListener("click", (e) => {
    if (e.target === modal) {
        hideModal();
    }
});

function createTaskForm() {
    const form = document.createElement("form");
    form.innerHTML = `
        <div class="mb-4">
            <label for="task-title" class="block text-sm font-medium text-gray-700">Task Title</label>
            <input type="text" id="task-title" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <div class="mb-4">
            <label for="task-due-date" class="block text-sm font-medium text-gray-700">Due Date</label>
            <input type="date" id="task-due-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <div class="mb-4">
            <label for="task-assignee" class="block text-sm font-medium text-gray-700">Assignee</label>
            <select id="task-assignee" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
                <option value="">Select Assignee</option>
            </select>
        </div>
        <div class="mb-4">
            <label for="task-status" class="block text-sm font-medium text-gray-700">Status</label>
            <select id="task-status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
            </select>
        </div>
        <div class="mb-4">
            <label for="task-priority" class="block text-sm font-medium text-gray-700">Priority</label>
            <select id="task-priority" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
            </select>
        </div>
        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Add Task</button>
    `;

    loadUserOptions();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newTask = {
            id: Date.now(),
            title: document.getElementById("task-title").value,
            assignee: parseInt(document.getElementById("task-assignee").value),
            status: document.getElementById("task-status").value,
            dueDate: document.getElementById("task-due-date").value,
            priority: document.getElementById("task-priority").value
        };

        const tasks = await db.getItem("tasks");
        tasks.push(newTask);
        await db.setItem("tasks", tasks);

        hideModal();
        loadTasks();
    });

    modalForm.appendChild(form);
}

function createProjectForm() {
    const form = document.createElement("form");
    form.innerHTML = `
        <div class="mb-4">
            <label for="project-name" class="block text-sm font-medium text-gray-700">Project Name</label>
            <input type="text" id="project-name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <div class="mb-4">
            <label for="project-status" class="block text-sm font-medium text-gray-700">Status</label>
            <select id="project-status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
            </select>
        </div>
        <div class="mb-4">
            <label for="project-completion" class="block text-sm font-medium text-gray-700">Completion Percentage</label>
            <input type="number" id="project-completion" min="0" max="100" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Add Project</button>
    `;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newProject = {
            id: Date.now(),
            name: document.getElementById("project-name").value,
            status: document.getElementById("project-status").value,
            completion: parseInt(document.getElementById("project-completion").value)
        };

        const projects = await db.getItem("projects");
        projects.push(newProject);
        await db.setItem("projects", projects);

        hideModal();
        loadProjects();
    });

    modalForm.appendChild(form);
}

function createTeamMemberForm() {
    const form = document.createElement("form");
    form.innerHTML = `
        <div class="mb-4">
            <label for="user-name" class="block text-sm font-medium text-gray-700">Full Name</label>
            <input type="text" id="user-name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <div class="mb-4">
            <label for="user-username" class="block text-sm font-medium text-gray-700">Username</label>
            <input type="text" id="user-username" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <div class="mb-4">
            <label for="user-password" class="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" id="user-password" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
        </div>
        <div class="mb-4">
            <label for="user-role" class="block text-sm font-medium text-gray-700">Role</label>
            <select id="user-role" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
            </select>
        </div>
        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Add Team Member</button>
    `;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newUser = {
            id: Date.now(),
            name: document.getElementById("user-name").value,
            username: document.getElementById("user-username").value,
            password: document.getElementById("user-password").value,
            role: document.getElementById("user-role").value,
            avatar: "/placeholder.svg?height=128&width=128"
        };

        const users = await db.getItem("users");
        users.push(newUser);
        await db.setItem("users", users);

        hideModal();
        loadTeam();
    });

    modalForm.appendChild(form);
}

async function loadUserOptions() {
    const users = await db.getItem("users");
    const select = document.getElementById("task-assignee");
    users.forEach(user => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.name;
        select.appendChild(option);
    });
}

// Initial load
document.addEventListener("DOMContentLoaded", () => {
    setupDatabase().then(() => {
        showSection("dashboard");
    });
});