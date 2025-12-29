document.addEventListener('DOMContentLoaded', () => {
    
    // Debug flag to control console outputs
    const DEBUG = false;

    // --- Mobile Menu Toggle ---
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });

        // Close menu when clicking a link
        document.querySelectorAll('header nav a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // --- Hero Background Animation (Bouncing Shapes) ---
    const heroAnimation = document.getElementById('hero-animation');
    if (heroAnimation) {
        const colors = ['#FFD700', '#FF0099', '#00F0FF'];
        const shapes = ['50%', '0%']; // Circle vs Square
        
        for (let i = 0; i < 15; i++) {
            const el = document.createElement('div');
            el.classList.add('shape');
            
            // Randomize props
            const size = Math.random() * 40 + 20 + 'px';
            const left = Math.random() * 100 + '%';
            const delay = Math.random() * 5 + 's';
            const duration = Math.random() * 10 + 10 + 's';
            const color = colors[Math.floor(Math.random() * colors.length)];
            const radius = shapes[Math.floor(Math.random() * shapes.length)];
            
            el.style.width = size;
            el.style.height = size;
            el.style.left = left;
            el.style.animationDelay = `-${delay}`;
            el.style.animationDuration = duration;
            el.style.backgroundColor = color;
            el.style.borderRadius = radius;
            
            heroAnimation.appendChild(el);
        }
    }

    // --- BACKEND WIRING START ---

    // Configuration
    const CONFIG = {
        effectId: 'glassesfilter',
        model: 'image-effects',
        toolType: 'image-effects',
        projectId: 'dressr',
        userId: 'DObRu1vyStbUynoQmTcHBlhs55z2'
    };

    // State
    let currentUploadedUrl = null;

    // DOM Elements
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const previewImage = document.getElementById('preview-image');
    const uploadContent = document.querySelector('.upload-content');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultFinal = document.getElementById('result-final');
    const resultPlaceholder = document.querySelector('.result-placeholder');
    const loadingState = document.getElementById('loading-state');
    const downloadBtn = document.getElementById('download-btn');

    // Setup Status Text in Loading State
    let statusText = loadingState.querySelector('.status-text');
    if (!statusText && loadingState) {
        statusText = document.createElement('p');
        statusText.className = 'status-text';
        statusText.style.color = 'white';
        statusText.style.marginTop = '1rem';
        statusText.style.fontWeight = 'bold';
        statusText.style.letterSpacing = '1px';
        loadingState.appendChild(statusText);
    }

    // --- Helper Functions ---

    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function updateStatus(msg) {
        if (statusText) statusText.textContent = msg;
        if (DEBUG) console.log(`[Status] ${msg}`);
    }

    function showLoading() {
        if (loadingState) loadingState.classList.remove('hidden');
    }

    function hideLoading() {
        if (loadingState) loadingState.classList.add('hidden');
    }

    function showError(msg) {
        alert('Error: ' + msg);
        hideLoading();
    }

    function showPreview(url) {
        if (previewImage) {
            previewImage.src = url;
            previewImage.classList.remove('hidden');
        }
        if (uploadContent) uploadContent.classList.add('hidden');
        if (resetBtn) resetBtn.classList.remove('hidden');
    }

    // --- API Functions ---

    // Upload file to CDN storage
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        const fileName = 'media/' + uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL
        const signedUrlResponse = await fetch(
            `https://core.faceswapper.ai/media/get-upload-url?fileName=${encodeURIComponent(fileName)}&projectId=${CONFIG.projectId}`,
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        if (DEBUG) console.log('Got signed URL');
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = 'https://assets.dressr.ai/' + fileName;
        if (DEBUG) console.log('Uploaded to:', downloadUrl);
        return downloadUrl;
    }

    // Submit generation job
    async function submitImageGenJob(imageUrl) {
        const endpoint = 'https://api.chromastudio.ai/image-gen';
        
        const body = {
            model: CONFIG.model,
            toolType: CONFIG.toolType,
            effectId: CONFIG.effectId,
            imageUrl: imageUrl,
            userId: CONFIG.userId,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        if (DEBUG) console.log('Job submitted:', data.jobId);
        return data;
    }

    // Poll job status
    async function pollJobStatus(jobId) {
        const POLL_INTERVAL = 2000;
        const MAX_POLLS = 60;
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `https://api.chromastudio.ai/image-gen/${CONFIG.userId}/${jobId}/status`,
                { method: 'GET' }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status');
            }
            
            const data = await response.json();
            if (DEBUG) console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                const resultItem = Array.isArray(data.result) ? data.result[0] : data.result;
                const resultUrl = resultItem?.mediaUrl || resultItem?.image;
                if (!resultUrl) throw new Error('No image URL in result');
                return resultUrl;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out');
    }

    // --- Event Handlers ---

    // File Selection Handler
    async function handleFileSelect(file) {
        if (!file) return;

        try {
            showLoading();
            updateStatus('UPLOADING...');
            
            // Upload immediately
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            // Update UI
            showPreview(uploadedUrl);
            updateStatus('READY');
            hideLoading();
            
            if (generateBtn) generateBtn.disabled = false;
            
        } catch (error) {
            if (DEBUG) console.error(error);
            showError(error.message);
        }
    }

    // Generate Handler
    async function handleGenerate() {
        if (!currentUploadedUrl) return;
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            
            if (generateBtn) generateBtn.disabled = true;
            
            // 1. Submit Job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            // 2. Poll for Result
            updateStatus('JOB QUEUED...');
            const resultUrl = await pollJobStatus(jobData.jobId);
            
            if (DEBUG) console.log('Result URL:', resultUrl);
            
            // 3. Display Result
            if (resultFinal) {
                // Set crossOrigin BEFORE src to allow canvas export later
                resultFinal.crossOrigin = 'anonymous';
                resultFinal.src = resultUrl;
                resultFinal.classList.remove('hidden');
                
                // Store URL for download
                if (downloadBtn) {
                    downloadBtn.dataset.url = resultUrl;
                    downloadBtn.disabled = false;
                }
            }
            
            if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
            
            updateStatus('COMPLETE');
            hideLoading();
            fireConfetti();
            
            if (generateBtn) generateBtn.disabled = false;
            
        } catch (error) {
            if (DEBUG) console.error(error);
            showError(error.message);
            if (generateBtn) generateBtn.disabled = false;
        }
    }

    // --- Wiring Event Listeners ---

    // Upload Zone & File Input
    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleFileSelect(file);
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileSelect(file);
            }
        });
    }

    // Generate Button
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentUploadedUrl = null;
            
            // Reset Preview
            if (previewImage) {
                previewImage.src = '';
                previewImage.classList.add('hidden');
            }
            
            // Reset Upload Area
            if (uploadContent) uploadContent.classList.remove('hidden');
            if (fileInput) fileInput.value = '';
            
            // Reset Result Area
            if (resultFinal) {
                resultFinal.src = '';
                resultFinal.classList.add('hidden');
                resultFinal.removeAttribute('src'); // Clear memory
            }
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            
            // Reset Buttons
            if (generateBtn) generateBtn.disabled = true;
            if (downloadBtn) {
                downloadBtn.disabled = true;
                downloadBtn.dataset.url = '';
            }
            resetBtn.classList.add('hidden');
        });
    }

    // Download Button - Canvas Approach (Safe against CORS errors if headers are missing)
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Saving...';
            downloadBtn.disabled = true;
            
            try {
                // Ensure image is loaded and valid
                if (resultFinal && resultFinal.complete && resultFinal.naturalWidth > 0) {
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = resultFinal.naturalWidth;
                    canvas.height = resultFinal.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw image
                    ctx.drawImage(resultFinal, 0, 0);
                    
                    // Convert to Blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = 'dressr_result_' + generateNanoId(8) + '.png';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            // Cleanup
                            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                        } else {
                            // Blob generation failed
                            throw new Error('Canvas export failed');
                        }
                        downloadBtn.textContent = originalText;
                        downloadBtn.disabled = false;
                    }, 'image/png');
                } else {
                    throw new Error('Image not ready');
                }
            } catch (err) {
                if (DEBUG) console.error('Download error:', err);
                alert('Direct download failed. Opening image in new tab. Right-click > Save Image As to save.');
                window.open(url, '_blank');
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }

    // --- FAQ Accordion ---
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            question.classList.toggle('active');
            const answer = question.nextElementSibling;
            if (question.classList.contains('active')) {
                answer.style.maxHeight = answer.scrollHeight + 'px';
            } else {
                answer.style.maxHeight = 0;
            }
        });
    });

    // --- Modals ---
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    const modalClosers = document.querySelectorAll('[data-modal-close]');
    
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = trigger.getAttribute('data-modal-target') + '-modal';
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.add('active');
        });
    });

    modalClosers.forEach(closer => {
        closer.addEventListener('click', () => {
            const modal = closer.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    // --- Confetti Effect Function ---
    function fireConfetti() {
        const count = 100;
        const container = document.body;
        const colors = ['#FFD700', '#FF0099', '#00F0FF'];

        for(let i = 0; i < 50; i++) {
            const conf = document.createElement('div');
            conf.style.width = '10px';
            conf.style.height = '10px';
            conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            conf.style.position = 'fixed';
            conf.style.left = '50%';
            conf.style.top = '50%';
            conf.style.zIndex = '9999';
            conf.style.pointerEvents = 'none';
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 5 + Math.random() * 10;
            const tx = Math.cos(angle) * velocity * 20;
            const ty = Math.sin(angle) * velocity * 20;
            
            conf.animate([
                { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) rotate(${Math.random()*360}deg)`, opacity: 0 }
            ], {
                duration: 1000 + Math.random() * 1000,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                fill: 'forwards'
            });
            
            container.appendChild(conf);
            setTimeout(() => conf.remove(), 2000);
        }
    }
});