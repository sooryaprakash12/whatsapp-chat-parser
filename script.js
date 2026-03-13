document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.zip';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const chatContainer = document.getElementById('chat-container');
    const badgeCount = document.getElementById('message-count-badge');
    const demoBtn = document.getElementById('demo-btn');

    // UI Events for Drag and Drop
    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
            readFile(file);
        } else if (file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
            readZipFile(file);
        } else {
            alert("Please upload a valid .txt or .zip file");
        }
    }

    function readZipFile(file) {
        if (typeof JSZip === "undefined") {
            alert("JSZip library not loaded. Please ensure you have internet access.");
            return;
        }

        JSZip.loadAsync(file).then(function (zip) {
            // WhatsApp chat exports typically contain a _chat.txt or WhatsApp Chat with...txt file
            const txtFiles = Object.keys(zip.files).filter(name => name.endsWith('.txt'));
            if (txtFiles.length > 0) {
                // Read the first .txt file found in the archive
                zip.files[txtFiles[0]].async("string").then(function (content) {
                    processChatText(content);
                });
            } else {
                alert("No .txt file found inside the ZIP archive.");
            }
        }).catch(function (err) {
            console.error("Error reading zip file:", err);
            alert("Error reading zip file. Make sure it is a valid WhatsApp export.");
        });
    }

    function readFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            processChatText(content);
        };
        reader.readAsText(file);
    }

    demoBtn.addEventListener('click', () => {
        const demoText = `[12/08/20, 10:02:00 PM] Sooryaprakash: Hello
[12/08/20, 10:03:00 PM] Mom: This message was deleted
[12/08/20, 10:03:15 PM] Mom: 🙏👍
[12/08/20, 10:03:25 PM] Sooryaprakash: Ennachi
[12/08/20, 10:03:30 PM] Mom: Maathi vanthirthu 🤣🤣🤣
[12/08/20, 10:03:35 PM] Sooryaprakash: <Media omitted>
[12/08/20, 10:03:45 PM] Mom: N.a. onnu type pana athu onnu pothu
[13/08/20, 10:03:45 PM] Mom: N.a. onnu type pana athu onnu pothu`;
        processChatText(demoText);
    });

    // Chat Parsing and Rendering Logic
    const senderColors = new Map();
    let colorIndex = 1;
    let mainUser = null; // We'll try to guess who "me" is to put on the right side

    function getSenderColorClass(sender) {
        if (!senderColors.has(sender)) {
            senderColors.set(sender, `color-${colorIndex}`);
            colorIndex = colorIndex >= 4 ? 1 : colorIndex + 1;
        }
        return senderColors.get(sender);
    }

    function processChatText(text) {
        chatContainer.innerHTML = '';
        senderColors.clear();
        colorIndex = 1;

        const lines = text.split('\n');
        const messages = [];

        // Regex for iOS format: [DD/MM/YY, HH:MM:SS AM/PM] Sender: Message
        // Regex for Android format: DD/MM/YY, HH:MM - Sender: Message
        // We will build a flexible regex to handle both.
        // For simplicity now, let's catch lines that start with date-like structures.
        const dateRegex = /^\[?(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)[\]\-\s]*(.*?):\s*(.*)/i;

        let currentMessage = null;

        for (const line of lines) {
            if (!line.trim()) continue;

            const match = line.match(dateRegex);
            if (match) {
                // New message
                if (currentMessage) {
                    messages.push(currentMessage);
                }
                const [_, date, time, sender, msg] = match;
                currentMessage = {
                    date,
                    time,
                    sender: sender.trim(),
                    message: msg.trim(),
                    isSystem: false // Can enhance later for system messages
                };
            } else {
                // Continuation of previous message
                if (currentMessage) {
                    currentMessage.message += '\n' + line;
                } else {
                    // System message without clear format, or preamble
                    messages.push({
                        isSystem: true,
                        message: line.trim()
                    });
                }
            }
        }
        if (currentMessage) messages.push(currentMessage);

        renderMessages(messages);
    }

    function renderMessages(messages) {
        badgeCount.textContent = `Showing all ${messages.length} messages`;

        if (messages.length === 0) return;

        // Guess main user (first sender or most frequent sender often goes right but standard is right = me, left = them)
        // Usually, in WhatsApp exports, the user exporting is 'right'.
        // Let's assume the first sender is right for demo purposes, or we collect all senders and the user can swap.
        // For accurate UI, we need 2 sides. Let's make "Sooryaprakash" (from demo) standard right if exists, or randomly pick one.
        const senders = new Set(messages.filter(m => !m.isSystem).map(m => m.sender));
        let userRight = "Sooryaprakash"; // Fallback string
        if (!senders.has(userRight)) {
            userRight = Array.from(senders)[0];
        }

        const templateLeft = document.getElementById('message-template-left').content;
        const templateRight = document.getElementById('message-template-right').content;
        const templateSystem = document.getElementById('message-template-system').content;

        let lastDate = null;

        messages.forEach(msg => {
            let clone;
            let formattedDate = null;
            let formattedTime = msg.time;

            if (!msg.isSystem && msg.date) {
                const parts = msg.date.split(/[\/\.-]/);
                let day = parts[0];
                let month = parts[1];
                let year = parts[2];
                if (year.length === 2) year = '20' + year;
                const dateObj = new Date(year, parseInt(month) - 1, day);
                formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                const timeMatch = msg.time.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?/i);
                if (timeMatch) {
                    formattedTime = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3] ? timeMatch[3].toUpperCase() : ''}`.trim();
                }

                if (formattedDate !== lastDate) {
                    const dateWrapper = document.createElement('div');
                    dateWrapper.className = 'message-wrapper system';
                    const dateBadge = document.createElement('div');
                    dateBadge.className = 'badge';
                    dateBadge.textContent = formattedDate;
                    dateWrapper.appendChild(dateBadge);
                    chatContainer.appendChild(dateWrapper);
                    lastDate = formattedDate;
                }
            }

            if (msg.isSystem) {
                clone = document.importNode(templateSystem, true);
                clone.querySelector('.content').textContent = msg.message;
            } else {
                const isRight = msg.sender === userRight;
                clone = document.importNode(isRight ? templateRight : templateLeft, true);

                const senderEl = clone.querySelector('.sender');
                senderEl.textContent = msg.sender;
                senderEl.classList.add(getSenderColorClass(msg.sender));

                clone.querySelector('.content').textContent = msg.message;

                // Format timestamp beautifully
                let displayTime = msg.time;
                if (formattedDate) {
                    displayTime = `${formattedDate}, ${formattedTime}`;
                }
                clone.querySelector('.timestamp').textContent = displayTime;
            }
            chatContainer.appendChild(clone);
        });

        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
    }
});
