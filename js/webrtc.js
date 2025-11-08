import { auth, db } from './firebase-config.js';
import { 
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot, 
    updateDoc,
    deleteDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callId = null;
let isMuted = false;
let isVideoOff = false;

// Initialize call
async function initializeCall() {
    const callUserId = localStorage.getItem('callUserId');
    const callUsername = localStorage.getItem('callUsername');
    const callType = localStorage.getItem('callType') || 'video';
    
    if (!callUserId || !auth.currentUser) {
        alert('Invalid call parameters');
        window.close();
        return;
    }
    
    document.getElementById('participantName').textContent = callUsername;
    
    try {
        // Get local stream
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video' ? {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } : false
        });
        
        document.getElementById('localVideo').srcObject = localStream;
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        
        // Add local tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        remoteStream = new MediaStream();
        document.getElementById('remoteVideo').srcObject = remoteStream;
        
        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
        };
        
        // Create call document
        callId = `${auth.currentUser.uid}_${callUserId}_${Date.now()}`;
        const callDoc = doc(db, 'calls', callId);
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // ICE candidates
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                const callData = await getDoc(callDoc);
                if (callData.exists()) {
                    const candidates = callData.data().callerCandidates || [];
                    await updateDoc(callDoc, {
                        callerCandidates: [...candidates, event.candidate.toJSON()]
                    });
                }
            }
        };
        
        // Save call to Firestore
        await setDoc(callDoc, {
            callerId: auth.currentUser.uid,
            receiverId: callUserId,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            },
            callType: callType,
            status: 'ringing',
            createdAt: serverTimestamp(),
            callerCandidates: [],
            receiverCandidates: []
        });
        
        // Listen for answer
        onSnapshot(callDoc, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;
            
            if (data.answer && !peerConnection.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answerDescription);
                
                // Add receiver ICE candidates
                if (data.receiverCandidates) {
                    data.receiverCandidates.forEach(async (candidate) => {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    });
                }
            }
            
            if (data.status === 'ended') {
                endCall();
            }
        });
        
        startCallTimer();
        
    } catch (error) {
        console.error('Error initializing call:', error);
        alert('Could not access camera/microphone. Please check permissions.');
        window.close();
    }
}

// Toggle mute
function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isMuted = !audioTrack.enabled;
            
            const btn = document.getElementById('muteBtn');
            if (isMuted) {
                btn.innerHTML = '<i class="fas fa-microphone-slash text-xl"></i><span class="text-xs">Unmute</span>';
                btn.classList.add('active');
            } else {
                btn.innerHTML = '<i class="fas fa-microphone text-xl"></i><span class="text-xs">Mute</span>';
                btn.classList.remove('active');
            }
        }
    }
}

// Toggle video
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isVideoOff = !videoTrack.enabled;
            
            const btn = document.getElementById('videoBtn');
            if (isVideoOff) {
                btn.innerHTML = '<i class="fas fa-video-slash text-xl"></i><span class="text-xs">Start Video</span>';
                btn.classList.add('active');
            } else {
                btn.innerHTML = '<i class="fas fa-video text-xl"></i><span class="text-xs">Stop Video</span>';
                btn.classList.remove('active');
            }
        }
    }
}

// End call
async function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnection) {
        peerConnection.close();
    }
    
    if (callId) {
        const callDoc = doc(db, 'calls', callId);
        await updateDoc(callDoc, {
            status: 'ended',
            endedAt: serverTimestamp()
        });
        
        setTimeout(async () => {
            await deleteDoc(callDoc);
        }, 5000);
    }
    
    window.close();
}

// Call timer
let seconds = 0;
function startCallTimer() {
    setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.getElementById('callTimer').textContent = 
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// Initialize on load
window.addEventListener('load', initializeCall);
window.toggleMute = toggleMute;
window.toggleVideo = toggleVideo;
window.endCall = endCall;