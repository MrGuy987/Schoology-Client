const preview = {
	user: { name: "Alex Morgan", school: "Northwood High School" },
	courses: [
		{ id: "bio", code: "BIO", name: "Biology II", teacher: "Ms. Rivera", color: "green", room: "Science · 204", grade: "A−" },
		{ id: "lit", code: "LIT", name: "World Literature", teacher: "Mr. Chen", color: "blue", room: "Humanities · 118", grade: "A" },
		{ id: "alg", code: "ALG", name: "Algebra II", teacher: "Dr. Patel", color: "rose", room: "Mathematics · 301", grade: "B+" },
		{ id: "his", code: "HIS", name: "Modern History", teacher: "Ms. Brooks", color: "gold", room: "Humanities · 212", grade: "A−" }
	],
	assignments: [
		{ title: "Cellular respiration lab report", course: "Biology II", code: "BIO", color: "green", due: "Today · 11:59 PM", status: "Due today", kind: "soon" },
		{ title: "Close reading: The Odyssey", course: "World Literature", code: "LIT", color: "blue", due: "Tomorrow", status: "In progress", kind: "soon" },
		{ title: "Polynomial problem set 08", course: "Algebra II", code: "ALG", color: "rose", due: "Nov 10", status: "Not started", kind: "" },
		{ title: "Primary source analysis", course: "Modern History", code: "HIS", color: "gold", due: "Nov 12", status: "Not started", kind: "" },
		{ title: "Genetics quiz corrections", course: "Biology II", code: "BIO", color: "green", due: "Nov 14", status: "Submitted", kind: "submitted" },
		{ title: "Comparative essay outline", course: "World Literature", code: "LIT", color: "blue", due: "Nov 17", status: "Not started", kind: "" }
	],
	events: [
		{ date: "TODAY", day: "NOV 06", title: "Cellular respiration lab report", detail: "Biology II · Due 11:59 PM" },
		{ date: "FRI", day: "NOV 07", title: "Odyssey close reading", detail: "World Literature · Due 3:00 PM" },
		{ date: "MON", day: "NOV 10", title: "Polynomial problem set 08", detail: "Algebra II · Due 8:00 AM" }
	],
	grades: [
		{ name: "Biology II", score: 91, color: "green" }, { name: "World Literature", score: 94, color: "blue" },
		{ name: "Algebra II", score: 88, color: "rose" }, { name: "Modern History", score: 92, color: "gold" }
	],
	announcements: [
		{ mark: "BR", color: "", title: "Lab materials for next week", body: "Please bring your lab notebook and safety goggles for our cellular respiration investigation on Tuesday.", course: "Biology II · Ms. Rivera", time: "2 hours ago" },
		{ mark: "MC", color: "blue", title: "Essay conference sign-ups", body: "Conference slots for the comparative essay are posted. Choose one before Friday's class.", course: "World Literature · Mr. Chen", time: "Yesterday" },
		{ mark: "PB", color: "rose", title: "Chapter 7 review session", body: "Optional review in room 301 after school on Thursday. Bring questions from the practice set.", course: "Algebra II · Dr. Patel", time: "Nov 4" }
	],
	messages: [
		{ from: "Ms. Rivera", initials: "MR", color: "", subject: "Lab report feedback", preview: "Your draft is looking good. One note...", body: "Your draft is looking good. One note: make sure the graph axes include units and that you explain the control group in your conclusion. See you in class!", time: "Yesterday" },
		{ from: "Mr. Chen", initials: "MC", color: "blue", subject: "Re: conference time", preview: "Thursday at 10:15 works for me.", body: "Thursday at 10:15 works for me. Bring your thesis and the passage you want to discuss.", time: "Nov 3" },
		{ from: "Study group", initials: "SG", color: "rose", subject: "Algebra review this week", preview: "Are we still meeting in the library?", body: "Are we still meeting in the library after school on Thursday? I can bring the extra practice problems.", time: "Nov 2" }
	],
	notifications: [
		{ title: "Assignment due soon", body: "Cellular respiration lab report is due today at 11:59 PM.", detail: "Biology II · 20 minutes ago", unread: true },
		{ title: "New course announcement", body: "Ms. Rivera posted: Lab materials for next week.", detail: "Biology II · 2 hours ago", unread: true },
		{ title: "Grade posted", body: "Your Genetics quiz corrections have been graded.", detail: "Biology II · Yesterday", unread: true },
		{ title: "Message received", body: "Ms. Rivera sent you feedback on your lab report.", detail: "Messages · Yesterday", unread: false }
	]
};

const state = {
	view: "dashboard",
	data: structuredClone(preview),
	isLive: false,
	assignmentFilter: "All",
	calendarMonth: new Date(2026, 10, 1),
	messageIndex: 0,
	toastTimer: null
};

const page = document.querySelector("#page-content");
const dialog = document.querySelector("#settings-dialog");
const stored = {
	url: localStorage.getItem("schoology-worker-url") || "",
	token: localStorage.getItem("schoology-access-token") || ""
};

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
document.querySelector("#worker-url").value = stored.url;
document.querySelector("#access-token").value = stored.token;

function escapeHtml(value = "") {
	return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function normalizeList(payload, keys = []) {
	if (Array.isArray(payload)) return payload;
	for (const key of keys) {
		if (Array.isArray(payload?.[key])) return payload[key];
		if (Array.isArray(payload?.[key]?.section)) return payload[key].section;
		if (Array.isArray(payload?.[key]?.assignment)) return payload[key].assignment;
		if (Array.isArray(payload?.[key]?.event)) return payload[key].event;
	}
	return [];
}

function setConnectedUser(user) {
	const firstName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Schoology student";
	state.data.user.name = firstName;
	state.data.user.school = user?.school_title || user?.school_name || "Schoology account";
	document.querySelector("#profile-name").textContent = firstName;
	document.querySelector("#term-user").textContent = state.data.user.school;
	document.querySelector("#top-avatar").textContent = firstName.trim().charAt(0).toUpperCase() || "S";
	document.querySelector("#profile-button .avatar").textContent = firstName.trim().charAt(0).toUpperCase() || "S";
}

function setDataStatus() {
	document.querySelector("#connection-label").textContent = state.isLive ? "SCHOOLOGY SYNCED" : "PREVIEW MODE";
	document.querySelector("#data-status").textContent = state.isLive ? "Live Schoology sync · Preview-only views are marked" : "Preview data · Connect to your school to sync";
	document.querySelector("#course-count").textContent = String(state.data.courses.length).padStart(2, "0");
	document.querySelector("#assignment-count").textContent = String(state.data.assignments.length).padStart(2, "0");
}

function formatDue(value) {
	if (!value) return "Date not set";
	const date = new Date(Number(value) > 1e12 ? Number(value) : Number(value) * 1000);
	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function loadApi() {
	const base = stored.url.replace(/\/$/, "");
	return async (path) => {
		const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${stored.token}` } });
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(payload.error || `Schoology request failed (${response.status})`);
		return payload;
	};
}

async function syncSchoology() {
	const message = document.querySelector("#connection-message");
	const button = document.querySelector("#connect-button");
	const url = document.querySelector("#worker-url").value.trim().replace(/\/$/, "");
	const token = document.querySelector("#access-token").value.trim();
	if (!url || !token) {
		message.textContent = "Add your Worker URL and private access token first.";
		return;
	}
	stored.url = url;
	stored.token = token;
	button.disabled = true;
	button.textContent = "Connecting...";
	message.textContent = "Checking your Worker and Schoology credentials...";
	try {
		const api = loadApi();
		const [user, sectionPayload] = await Promise.all([api("/api/me"), api("/api/sections")]);
		const sections = normalizeList(sectionPayload, ["section", "sections"]).map((section, index) => ({
			id: section.id || `section-${index}`,
			code: String(section.course_nid || section.id || "SCH").slice(-3).toUpperCase(),
			name: section.course_title || section.section_title || section.title || "Untitled course",
			teacher: section.instructor_name || section.instructor || "Schoology course",
			color: ["green", "blue", "rose", "gold"][index % 4],
			room: section.building || "Enrolled course",
			grade: "—"
		}));
		const assignmentGroups = await Promise.all(sections.filter((section) => !String(section.id).startsWith("section-")).map(async (section) => {
			try {
				const payload = await api(`/api/sections/${encodeURIComponent(section.id)}/assignments`);
				return normalizeList(payload, ["assignment", "assignments"]).map((assignment) => ({
					title: assignment.title || "Untitled assignment",
					course: section.name,
					code: section.code,
					color: section.color,
					due: formatDue(assignment.due || assignment.due_date),
					status: assignment.submitted ? "Submitted" : "Not started",
					kind: assignment.submitted ? "submitted" : ""
				}));
			} catch { return []; }
		}));
		let events = [];
		try {
			const eventPayload = await api("/api/events");
			events = normalizeList(eventPayload, ["event", "events"]).map((event) => ({
				date: formatDue(event.start || event.start_time || event.date),
				day: "SCHOOL",
				title: event.title || "School event",
				detail: event.location || event.description || "Schoology calendar"
			}));
		} catch { /* Calendar endpoints may be disabled for personal API keys. */ }
		if (sections.length) state.data.courses = sections;
		if (assignmentGroups.flat().length) state.data.assignments = assignmentGroups.flat();
		if (events.length) state.data.events = events;
		state.isLive = true;
		localStorage.setItem("schoology-worker-url", url);
		localStorage.setItem("schoology-access-token", token);
		setConnectedUser(user);
		setDataStatus();
		render();
		message.textContent = "Connected. Available Schoology data has been synced.";
		showToast("Schoology connection verified.");
		window.setTimeout(() => dialog.close(), 750);
	} catch (error) {
		state.isLive = false;
		setDataStatus();
		message.textContent = error.message || "Could not connect. Check the URL, token, and Worker logs.";
	} finally {
		button.disabled = false;
		button.innerHTML = "<span>↗</span> Save &amp; sync";
	}
}

function go(view) {
	state.view = view;
	document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
	document.querySelector("#breadcrumb-current").textContent = view[0].toUpperCase() + view.slice(1);
	document.querySelector("#sidebar").classList.remove("open");
	render();
	window.scrollTo({ top: 0, behavior: "smooth" });
}

function heading(kicker, title, subtitle, action = "") {
	return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p class="heading-subtitle">${subtitle}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
}

function previewNotice() {
	return state.isLive ? "" : `<div class="preview-notice"><span class="notice-icon">◌</span><span><strong>Preview workspace</strong> · Sample names, grades, and due dates are not connected to a real Schoology account.</span><button data-action="settings">Connect Schoology ↗</button></div>`;
}

function panelHeader(title, action = "") {
	return `<div class="panel-header"><h2>${title}</h2>${action}</div>`;
}

function metricCard(label, value, note, symbol) {
	return `<div class="metric-card"><div class="metric-label">${label}<span class="metric-symbol">${symbol}</span></div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`;
}

function courseCard(course) {
	return `<article class="course-card" data-course="${escapeHtml(course.name)}"><div class="course-card-top"><span class="course-chip ${course.color}">${escapeHtml(course.code)}</span><span class="color-dot ${course.color}"></span></div><h3 class="course-card-name">${escapeHtml(course.name)}</h3><p class="course-card-teacher">${escapeHtml(course.teacher)}</p><span class="course-card-meta">${escapeHtml(course.room || "Course")}</span></article>`;
}

function assignmentRow(item, full = false) {
	const due = escapeHtml(item.due || "No due date");
	const status = item.status || "Not started";
	return `<div class="assignment-row"><span class="course-chip ${item.color || "green"}">${escapeHtml(item.code || "SCH")}</span><div class="assignment-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.course || "Schoology")}</small></div>${full ? `<span class="status-pill ${item.kind || ""}">${escapeHtml(status)}</span>` : ""}<div class="due-copy ${item.kind === "overdue" ? "late" : ""}">${due}</div></div>`;
}

function agendaList(events = state.data.events) {
	return `<div class="agenda-list">${events.slice(0, 4).map((event) => `<div class="agenda-item"><div class="agenda-date">${escapeHtml(event.date)}<small>${escapeHtml(event.day)}</small></div><div class="agenda-copy"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.detail)}</small></div></div>`).join("")}</div>`;
}

function dashboardView() {
	const action = `<button class="button-primary" data-action="settings"><span>＋</span> Connect Schoology</button>`;
	return `${heading("THURSDAY, NOVEMBER 06", `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${escapeHtml(state.data.user.name.split(" ")[0])}.`, "A clear view of what needs your attention.", state.isLive ? "" : action)}${previewNotice()}<section class="metric-row">${metricCard("Active courses", state.data.courses.length, "Across your schedule", "▤")}${metricCard("Due this week", Math.min(state.data.assignments.length, 6), "2 need attention", "◷")}${metricCard("Current average", state.isLive ? "—" : "91%", state.isLive ? "Grades not synced" : "Across 4 courses", "⌁")}${metricCard("Unread updates", state.data.notifications.filter((item) => item.unread).length, "Announcements & messages", "♧")}</section><div class="overview-grid"><div class="main-stack"><section class="panel">${panelHeader("Coming up", `<button class="panel-link" data-view="assignments">All assignments ↗</button>`)}<div class="assignment-list">${state.data.assignments.slice(0, 4).map((item) => assignmentRow(item)).join("")}</div></section><section class="panel">${panelHeader("Your courses", `<button class="panel-link" data-view="courses">View all ↗</button>`)}<div class="course-list">${state.data.courses.slice(0, 4).map(courseCard).join("") || `<div class="empty-state">No courses returned. Check your Schoology API permissions.</div>`}</div></section></div><div class="side-stack"><section class="panel">${panelHeader("Next on your calendar", `<button class="panel-link" data-view="calendar">Full calendar ↗</button>`)}${agendaList()}</section><section class="panel">${panelHeader("A quick pulse", `<span class="panel-kicker">THIS TERM</span>`)}<div class="stat-line"><span class="stat-ring">${state.isLive ? "—" : "91"}</span><div class="stat-copy"><strong>${state.isLive ? "Grades need confirmation" : "Strong start this term"}</strong><small>${state.isLive ? "Your live gradebook is not connected" : "You're keeping a steady pace"}</small></div></div></section><section class="panel">${panelHeader("Latest announcement", `<button class="panel-link" data-view="announcements">More ↗</button>`)}<div class="agenda-list"><div class="agenda-item"><span class="feed-mark">${escapeHtml(state.data.announcements[0].mark)}</span><div class="agenda-copy"><strong>${escapeHtml(state.data.announcements[0].title)}</strong><small>${escapeHtml(state.data.announcements[0].course)}</small></div></div></div></section></div></div>`;
}

function coursesView() {
	return `${heading("YOUR LEARNING", "Courses", `${state.data.courses.length} courses in your workspace.`)}${previewNotice()}<div class="course-list">${state.data.courses.map(courseCard).join("") || `<div class="empty-state">No courses found. Confirm your API access and sync again.</div>`}</div>`;
}

function assignmentsView() {
	const filters = ["All", "Not started", "Submitted"];
	return `${heading("STAY ON TRACK", "Assignments", "A single list of what is due and what is done.", `<button class="button-secondary" data-action="settings">↻ Sync</button>`)}${previewNotice()}<div class="list-toolbar">${filters.map((filter) => `<button class="filter-button ${state.assignmentFilter === filter ? "selected" : ""}" data-filter="${filter}">${filter}</button>`).join("")}<input class="search-input" id="assignment-search" type="search" placeholder="Search assignments..." aria-label="Search assignments"></div><section class="panel">${panelHeader(`${state.data.assignments.length} assignments`, `<span class="panel-kicker">SORTED BY DUE DATE</span>`)}<div class="full-list" id="assignment-results">${state.data.assignments.map((item) => assignmentRow(item, true)).join("")}</div></section>`;
}

function gradesView() {
	const avg = state.data.grades.length ? Math.round(state.data.grades.reduce((sum, item) => sum + item.score, 0) / state.data.grades.length) : 0;
	return `${heading("YOUR PROGRESS", "Grades", "A quick read on how the term is going.")}${previewNotice()}<div class="grades-grid"><div class="main-stack"><section class="panel">${panelHeader("Term snapshot", `<span class="panel-kicker">CURRENT TERM</span>`)}<div class="grade-summary"><span class="grade-big">${state.isLive ? "—" : `${avg}%`}</span><div class="grade-caption"><strong>${state.isLive ? "Live grade data isn't connected yet" : "Overall average"}</strong><span>${state.isLive ? "Use Schoology's own gradebook for confirmed marks." : "Based on current course averages · illustrative only"}</span></div></div>${!state.isLive ? `<div class="grade-bars">${state.data.grades.map((grade) => `<div class="grade-bar-row"><span>${escapeHtml(grade.name)}</span><div class="grade-track"><div class="grade-fill" style="width:${grade.score}%"></div></div><span class="grade-score">${grade.score}%</span></div>`).join("")}</div>` : ""}</section></div><aside class="panel"><div class="panel-header"><h2>About these grades</h2></div><p class="grade-note">${state.isLive ? "The Schoology API connection is active, but this workspace has not fetched a verified grade endpoint. No live marks are shown here." : "These are sample values for the interface preview, not your actual school records."}<br><br><strong>Always verify marks in your school's official gradebook.</strong></p></aside></div>`;
}

function calendarView() {
	const year = state.calendarMonth.getFullYear();
	const month = state.calendarMonth.getMonth();
	const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(state.calendarMonth);
	const firstDay = new Date(year, month, 1).getDay();
	const offset = (firstDay + 6) % 7;
	const days = new Date(year, month + 1, 0).getDate();
	const prevDays = new Date(year, month, 0).getDate();
	let cells = "";
	for (let index = 0; index < 42; index++) {
		const dateNumber = index - offset + 1;
		const inMonth = dateNumber > 0 && dateNumber <= days;
		const number = dateNumber < 1 ? prevDays + dateNumber : dateNumber > days ? dateNumber - days : dateNumber;
		const today = inMonth && year === new Date().getFullYear() && month === new Date().getMonth() && dateNumber === new Date().getDate();
		const event = inMonth && state.data.events.some((item) => item.date.toLowerCase().includes(new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(year, month, dateNumber)).toLowerCase()) && item.date.includes(String(dateNumber)));
		cells += `<div class="calendar-day ${inMonth ? "" : "muted"} ${today ? "today" : ""} ${event ? "event-day" : ""}">${number}</div>`;
	}
	return `${heading("PLAN YOUR WEEK", "Calendar", "Deadlines and school events, together.", `<button class="button-secondary" data-action="settings">↻ Sync</button>`)}${previewNotice()}<div class="calendar-layout"><section class="panel calendar-panel"><div class="calendar-head"><strong id="calendar-month">${monthName}</strong><div class="calendar-controls"><button data-month="-1" aria-label="Previous month">‹</button><button data-month="1" aria-label="Next month">›</button></div></div><div class="calendar-grid">${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${cells}</div></section><section class="panel">${panelHeader("Upcoming", `<span class="panel-kicker">NEXT 7 DAYS</span>`)}${agendaList()}</section></div>`;
}

function announcementsView() {
	return `${heading("FROM YOUR COURSES", "Announcements", "Notes and updates shared by your teachers.")}${previewNotice()}<section class="panel">${panelHeader("Recent announcements", `<span class="panel-kicker">${state.isLive ? "PREVIEW ITEMS" : "SAMPLE CONTENT"}</span>`)}<div class="feed-list">${state.data.announcements.map((item) => `<article class="feed-item"><span class="feed-mark ${item.color}">${escapeHtml(item.mark)}</span><div class="feed-copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${escapeHtml(item.course)}</small></div><span class="feed-time">${escapeHtml(item.time)}</span></article>`).join("")}</div></section>`;
}

function messagesView() {
	const selected = state.data.messages[state.messageIndex];
	return `${heading("SCHOOL INBOX", "Messages", "A quiet place for school conversations.")}${previewNotice()}<section class="panel message-layout"><div class="message-inbox"><div class="panel-header"><h2>Recent</h2><span class="panel-kicker">${state.data.messages.length}</span></div><div class="message-list">${state.data.messages.map((item, index) => `<button class="message-entry ${index === state.messageIndex ? "selected" : ""}" data-message="${index}"><span class="feed-mark ${item.color}">${escapeHtml(item.initials)}</span><span><strong>${escapeHtml(item.from)}</strong><small>${escapeHtml(item.subject)}</small></span></button>`).join("")}</div></div><div class="message-preview">${selected ? `<span class="eyebrow">${escapeHtml(selected.time)} · ${escapeHtml(selected.from)}</span><h3>${escapeHtml(selected.subject)}</h3><p>${escapeHtml(selected.body)}</p>` : `<h3>No message selected</h3><p>Choose a message from the inbox.</p>`}</div></section>`;
}

function notificationsView() {
	return `${heading("KEEP UP", "Notifications", "The updates that deserve a second look.", `<button class="button-secondary" data-action="mark-read">✓ Mark all read</button>`)}${previewNotice()}<section class="panel">${panelHeader("Recent activity", `<span class="panel-kicker">${state.data.notifications.filter((item) => item.unread).length} UNREAD</span>`)}<div class="feed-list">${state.data.notifications.map((item) => `<article class="notification-item ${item.unread ? "" : "read"}"><span class="unread-dot"></span><div class="notification-copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${escapeHtml(item.detail)}</small></div><span class="feed-time">${item.unread ? "NEW" : "READ"}</span></article>`).join("")}</div></section>`;
}

function render() {
	const views = { dashboard: dashboardView, courses: coursesView, assignments: assignmentsView, grades: gradesView, calendar: calendarView, announcements: announcementsView, messages: messagesView, notifications: notificationsView };
	page.innerHTML = (views[state.view] || dashboardView)();
	bindPageActions();
}

function showToast(message) {
	const toast = document.querySelector("#toast");
	toast.textContent = message;
	toast.classList.add("visible");
	window.clearTimeout(state.toastTimer);
	state.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function bindPageActions() {
	page.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => go(button.dataset.view)));
	page.querySelectorAll('[data-action="settings"]').forEach((button) => button.addEventListener("click", () => dialog.showModal()));
	page.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
		state.assignmentFilter = button.dataset.filter;
		render();
	}));
	page.querySelectorAll("[data-month]").forEach((button) => button.addEventListener("click", () => {
		state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + Number(button.dataset.month), 1);
		render();
	}));
	page.querySelectorAll("[data-message]").forEach((button) => button.addEventListener("click", () => {
		state.messageIndex = Number(button.dataset.message);
		render();
	}));
	page.querySelectorAll('[data-action="mark-read"]').forEach((button) => button.addEventListener("click", () => {
		state.data.notifications.forEach((item) => { item.unread = false; });
		render();
		showToast("All notifications marked as read.");
	}));
	page.querySelectorAll(".course-card").forEach((card) => card.addEventListener("click", () => {
		go("assignments");
		const search = document.querySelector("#assignment-search");
		if (search) { search.value = card.dataset.course; search.dispatchEvent(new Event("input")); }
	}));
	const search = document.querySelector("#assignment-search");
	if (search) search.addEventListener("input", filterAssignments);
	if (search && state.assignmentSearch) { search.value = state.assignmentSearch; filterAssignments(); }
}

function filterAssignments() {
	const search = document.querySelector("#assignment-search");
	state.assignmentSearch = search.value;
	const query = search.value.toLowerCase();
	const rows = [...document.querySelectorAll("#assignment-results .assignment-row")];
	rows.forEach((row, index) => {
		const item = state.data.assignments[index];
		const matchesText = `${item.title} ${item.course}`.toLowerCase().includes(query);
		const matchesStatus = state.assignmentFilter === "All" || item.status === state.assignmentFilter;
		row.hidden = !matchesText || !matchesStatus;
	});
}

document.querySelectorAll(".nav-link, .topbar [data-view]").forEach((button) => button.addEventListener("click", () => go(button.dataset.view)));
document.querySelector("#open-settings").addEventListener("click", () => dialog.showModal());
document.querySelector("#profile-button").addEventListener("click", () => dialog.showModal());
document.querySelector("#connect-button").addEventListener("click", syncSchoology);
document.querySelector("#disconnect-button").addEventListener("click", () => {
	localStorage.removeItem("schoology-worker-url");
	localStorage.removeItem("schoology-access-token");
	stored.url = "";
	stored.token = "";
	state.data = structuredClone(preview);
	state.isLive = false;
	setConnectedUser(state.data.user);
	setDataStatus();
	document.querySelector("#worker-url").value = "";
	document.querySelector("#access-token").value = "";
	document.querySelector("#connection-message").textContent = "Disconnected. Preview data restored.";
	render();
});
document.querySelector("#mobile-menu").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelector("#search-button").addEventListener("click", () => {
	go("assignments");
	document.querySelector("#assignment-search")?.focus();
});
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

setConnectedUser(state.data.user);
setDataStatus();
render();

if (stored.url && stored.token) {
	const api = loadApi();
	Promise.all([api("/api/me"), api("/api/sections")]).then(([user, payload]) => {
		const sections = normalizeList(payload, ["section", "sections"]);
		setConnectedUser(user);
		if (sections.length) state.data.courses = sections.map((section, index) => ({ id: section.id, code: String(section.course_nid || section.id || "SCH").slice(-3).toUpperCase(), name: section.course_title || section.section_title || "Course", teacher: section.instructor_name || "Schoology", color: ["green", "blue", "rose", "gold"][index % 4], room: "Enrolled course", grade: "—" }));
		state.isLive = true;
		setDataStatus();
		render();
	}).catch(() => { state.isLive = false; setDataStatus(); });
}
