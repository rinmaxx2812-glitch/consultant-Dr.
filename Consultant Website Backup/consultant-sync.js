// ================= CONSULTANT DOCTOR REAL-TIME SYNC ENGINE =================
const ConsultantSync = (() => {
    const STORAGE_KEY = 'consultant_doctor_state_v1';
    const CHANNEL_NAME = 'consultant_doctor_channel_v1';
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

    function getDefaultState() {
        return {
            currentPatientId: 'p_demo_1',
            patients: {
                p_demo_1: {
                    id: 'p_demo_1',
                    name: 'Su Myat Aung',
                    phone: '09 420 987 654',
                    submittedAt: '19 Nov 2026, 10:20 AM',
                    paymentStatus: 'approved', // 'none' | 'pending' | 'approved' | 'rejected'
                    screenshotDataUrl: ''
                }
            },
            chats: {
                p_demo_1: [
                    { sender: 'patient', text: 'မင်္ဂလာပါ ဆရာ။ ခေါင်းကိုက်ပြီး ဖျားနေတာ နှစ်ရက်ရှိပါပြီ။', time: '10:22 AM' },
                    { sender: 'doctor', text: 'မင်္ဂလာပါ။ အဖျားဘယ်လောက်ရှိလဲ၊ လည်ချောင်းနာတာ ချောင်းဆိုးတာရော ရှိပါသလား။', time: '10:23 AM' }
                ]
            }
        };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                const initial = getDefaultState();
                saveState(initial, false);
                return initial;
            }
            return JSON.parse(raw);
        } catch (err) {
            return getDefaultState();
        }
    }

    function saveState(state, notify = true) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (notify && channel) {
            channel.postMessage({ type: 'STATE_UPDATED', state });
        }
    }

    function formatTimeNow() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateTimeNow() {
        return new Date().toLocaleString([], {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Step 1: Register or update current patient
    function registerPatient(name, phone) {
        const state = loadState();
        const safePhone = phone.trim();
        const existingId = Object.keys(state.patients).find(
            id => state.patients[id].phone.replace(/\s+/g, '') === safePhone.replace(/\s+/g, '')
        );

        const patientId = existingId || `p_${Date.now()}`;
        const prev = state.patients[patientId];

        state.patients[patientId] = {
            id: patientId,
            name: name.trim(),
            phone: safePhone,
            submittedAt: prev?.submittedAt || formatDateTimeNow(),
            paymentStatus: prev?.paymentStatus === 'approved' ? 'approved' : 'none',
            screenshotDataUrl: prev?.screenshotDataUrl || ''
        };

        if (!state.chats[patientId]) {
            state.chats[patientId] = [];
        }

        state.currentPatientId = patientId;
        sessionStorage.setItem('consultant_patient_info', JSON.stringify({
            id: patientId,
            name: name.trim(),
            phone: safePhone
        }));

        saveState(state);
        return state.patients[patientId];
    }

    function getCurrentPatient() {
        const state = loadState();
        const sessionInfo = JSON.parse(sessionStorage.getItem('consultant_patient_info') || 'null');
        const id = sessionInfo?.id || state.currentPatientId;
        return state.patients[id] || null;
    }

    // Step 2: Patient submits KPay screenshot -> status becomes 'pending'
    function submitPaymentScreenshot(patientId, screenshotDataUrl) {
        const state = loadState();
        if (!state.patients[patientId]) return null;

        state.patients[patientId].paymentStatus = 'pending';
        state.patients[patientId].screenshotDataUrl = screenshotDataUrl;
        state.patients[patientId].submittedAt = formatDateTimeNow();

        saveState(state);
        return state.patients[patientId];
    }

    // Admin action: 'approved' | 'rejected'
    function setPaymentStatus(patientId, status) {
        const state = loadState();
        if (!state.patients[patientId]) return null;

        state.patients[patientId].paymentStatus = status;

        if (status === 'approved') {
            if (!state.chats[patientId]) state.chats[patientId] = [];
            const hasWelcome = state.chats[patientId].some(m => m.systemWelcome);
            if (!hasWelcome) {
                state.chats[patientId].push({
                    sender: 'doctor',
                    text: `မင်္ဂလာပါ ${state.patients[patientId].name}။ KPay ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ။ လက်ရှိခံစားနေရတဲ့ ကျန်းမာရေးအခြေအနေကို ဒီမှာ ရေးပို့နိုင်သလို Video Call / Phone Call ဖြင့်လည်း ဆွေးနွေးနိုင်ပါတယ်။`,
                    time: formatTimeNow(),
                    systemWelcome: true
                });
            }
        }

        saveState(state);
        return state.patients[patientId];
    }

    // Chat send ('patient' | 'doctor')
    function sendChatMessage(patientId, sender, text) {
        const clean = text.trim();
        if (!clean || !patientId) return null;

        const state = loadState();
        if (!state.chats[patientId]) {
            state.chats[patientId] = [];
        }

        const msg = {
            sender,
            text: clean,
            time: formatTimeNow()
        };

        state.chats[patientId].push(msg);
        saveState(state);
        return msg;
    }

    function getChats(patientId) {
        const state = loadState();
        return state.chats[patientId] || [];
    }

    function getAllPatients() {
        const state = loadState();
        return Object.values(state.patients);
    }

    function subscribe(callback) {
        const onUpdate = () => callback(loadState());
        if (channel) {
            channel.addEventListener('message', onUpdate);
        }
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) onUpdate();
        });
    }

    return {
        loadState,
        registerPatient,
        getCurrentPatient,
        submitPaymentScreenshot,
        setPaymentStatus,
        sendChatMessage,
        getChats,
        getAllPatients,
        subscribe
    };
})();