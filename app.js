// Pet shop inventory data (16 slots matching the smart contract array)
const PET_ADOPTION_DATA = [
    { name: "Apollo", breed: "Siberian Husky", age: "2 years" },
    { name: "Luna", breed: "Cocker Spaniel", age: "1 year" },
    { name: "Rex", breed: "German Shepherd", age: "4 years" },
    { name: "Daisy", breed: "Beagle", age: "6 months" },
    { name: "Ziggy", breed: "Poodle (Toy)", age: "3 months" },
    { name: "Nova", breed: "Rottweiler", age: "3 years" },
    { name: "Finn", breed: "Dachshund", age: "2 years" },
    { name: "Willow", breed: "Shih Tzu", age: "5 years" },
    { name: "Kobe", breed: "Labrador Retriever", age: "1 year" },
    { name: "Zoe", breed: "Corgi", age: "2 years" },
    { name: "Milo", breed: "Pomeranian", age: "8 months" },
    { name: "Skye", breed: "Border Collie", age: "4 years" },
    { name: "Bear", breed: "Great Dane", age: "3 years" },
    { name: "Nala", breed: "Samoyed", age: "2 years" },
    { name: "Jasper", breed: "Chow Chow", age: "3 months" },
    { name: "Ollie", breed: "Boston Terrier", age: "1 year" }
];

// Contract ABI - Defines the contract interface for web3
const ADOPTION_CONTRACT_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "petId", "type": "uint256" }],
        "name": "adopt",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "adopters",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAdopters",
        "outputs": [{ "internalType": "address[16]", "name": "", "type": "address[16]" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// Deployed contract address on the target network
const CONTRACT_DEPLOYED_ADDRESS = "0xfcC2dBA3D7663F40d75Ca119dbE79f94B064BBFd";

// Network constants
const TARGET_CHAIN_ID_HEX = '0xaa36a7'; // Sepolia Chain ID (11155111)
const TARGET_NETWORK_NAME = 'Sepolia Testnet';

let currentWeb3Instance = null;
let adoptionContractInstance = null;
let currentWalletAccount = null;

// Helper: safe truncate an Ethereum address (keeps last 4 chars robustly)
function shortAddress(addr) {
    if (!addr || typeof addr !== 'string') return '';
    const len = addr.length;
    if (len <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Initialize dApp on page load
window.addEventListener('load', async () => {
    renderAllPetCards();

    if (typeof window.ethereum !== 'undefined') {
        console.info('Ethereum provider detected.');
        // Attach accounts/network listeners (if provider exists)
        window.ethereum.on && window.ethereum.on('chainChanged', () => {
            // Full reload ensures UI and provider state sync cleanly.
            window.location.reload();
        });

        window.ethereum.on && window.ethereum.on('accountsChanged', (accounts) => {
            // If no accounts, clear UI and stored state
            if (!accounts || accounts.length === 0) {
                currentWalletAccount = null;
                document.getElementById('accountDisplay').textContent = '';
                document.getElementById('connectButton').textContent = 'Connect Wallet';
                document.getElementById('connectButton').disabled = false;
                adoptionContractInstance = null;
                currentWeb3Instance = null;
                fetchAndUpdateAdoptionStatuses(); // refresh UI to re-enable buttons
            } else {
                // Use first account and refresh statuses
                currentWalletAccount = accounts[0];
                document.getElementById('accountDisplay').textContent =
                    `Active Wallet: ${shortAddress(currentWalletAccount)} (${TARGET_NETWORK_NAME})`;
                fetchAndUpdateAdoptionStatuses();
            }
        });
    } else {
        alert('MetaMask or a compatible Ethereum wallet is required to use this decentralized application!');
    }
});

// Utility: attempt to switch to the Sepolia network (or add it)
async function ensureSepoliaNetwork() {
    if (!window.ethereum) return false;

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: TARGET_CHAIN_ID_HEX }],
        });
        return true;
    } catch (switchError) {
        // If chain not added, add it
        if (switchError && switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: TARGET_CHAIN_ID_HEX,
                        chainName: TARGET_NETWORK_NAME,
                        nativeCurrency: {
                            name: 'Sepolia ETH',
                            symbol: 'ETH',
                            decimals: 18,
                        },
                        // NOTE: RPC URL is left generic; Metamask will accept it.
                        rpcUrls: ['https://sepolia.infura.io/v3/'],
                        blockExplorerUrls: ['https://sepolia.etherscan.io'],
                    }],
                });
                return true;
            } catch (addError) {
                console.error('Failed to add the Sepolia network:', addError);
                return false;
            }
        }
        console.error('Error switching network:', switchError);
        return false;
    }
}

// Verify current network is the target network
async function verifyCurrentNetwork() {
    if (!window.ethereum) return false;
    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        return chainId === TARGET_CHAIN_ID_HEX;
    } catch (err) {
        console.error('Unable to read chainId:', err);
        return false;
    }
}

// Connect Wallet Button Handler (safe attach)
const connectBtn = document.getElementById('connectButton');
if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        if (!window.ethereum) {
            alert('Please install MetaMask or another Ethereum wallet extension first.');
            return;
        }

        try {
            // Request accounts
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) {
                alert('No accounts returned.');
                return;
            }
            currentWalletAccount = accounts[0];

            // Check network
            const onTarget = await verifyCurrentNetwork();
            if (!onTarget) {
                const shouldAttemptSwitch = confirm(
                    `The dApp is configured for the ${TARGET_NETWORK_NAME}. Click OK to prompt an automatic switch in MetaMask.`
                );
                if (shouldAttemptSwitch) {
                    const switched = await ensureSepoliaNetwork();
                    if (!switched) {
                        alert(`Please switch your wallet manually to ${TARGET_NETWORK_NAME} and reconnect.`);
                        return;
                    }
                    // short delay to give provider time to update
                    await new Promise(res => setTimeout(res, 800));
                } else {
                    alert(`Cannot proceed without connecting to ${TARGET_NETWORK_NAME}.`);
                    return;
                }
            }

            // Init web3 + contract instances
            currentWeb3Instance = new Web3(window.ethereum);
            adoptionContractInstance = new currentWeb3Instance.eth.Contract(ADOPTION_CONTRACT_ABI, CONTRACT_DEPLOYED_ADDRESS);

            // Update UI
            document.getElementById('accountDisplay').textContent = `Active Wallet: ${shortAddress(currentWalletAccount)} (${TARGET_NETWORK_NAME})`;
            connectBtn.textContent = 'Wallet Connected';
            connectBtn.disabled = true;

            // Fetch adoption statuses
            await fetchAndUpdateAdoptionStatuses();
        } catch (err) {
            console.error('Wallet connection error:', err);
            if (err && err.code === 4001) {
                alert('Connection request denied by user.');
            } else {
                alert('Failed to connect wallet. See console for details.');
            }
        }
    });
}

// Render all pet cards and attach handlers
function renderAllPetCards() {
    const containerElement = document.getElementById('petsRow');
    if (!containerElement) return;

    PET_ADOPTION_DATA.forEach((petDetails, petIndex) => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'pet-card';
        cardWrapper.innerHTML = `
            <img class="pet-image" src="images/pet-${petIndex}.jpeg" alt="${petDetails.name}" onerror="this.src='https://via.placeholder.com/400x300.png?text=Pet+${petIndex + 1}'">
            <div class="pet-name">${petDetails.name}</div>
            <div class="pet-breed">${petDetails.breed}</div>
            <div class="pet-age">Approx. Age: ${petDetails.age}</div>
            <div class="adopter-info" data-adopter-id="${petIndex}"></div>
            <button class="adopt-btn" data-id="${petIndex}">Adopt Today!</button>
        `;
        containerElement.appendChild(cardWrapper);
    });

    // Attach event listeners to adoption buttons (delegation-safe)
    document.querySelectorAll('.adopt-btn').forEach(button => {
        button.addEventListener('click', processAdoptionRequest);
    });
}

// Fetch adoption statuses and update UI
async function fetchAndUpdateAdoptionStatuses() {
    // Reset UI if contract not set
    if (!adoptionContractInstance) {
        // Ensure all buttons enabled (unless someone adopted offline)
        document.querySelectorAll('.adopt-btn').forEach(btn => {
            btn.textContent = 'Adopt Today!';
            btn.disabled = false;
        });
        document.querySelectorAll('.adopter-info').forEach(info => info.innerHTML = '');
        return;
    }

    try {
        let currentAdopters;
        try {
            currentAdopters = await adoptionContractInstance.methods.getAdopters().call();
            console.log('getAdopters() returned:', currentAdopters);
        } catch (err) {
            // Fallback: query individually
            console.warn('getAdopters() failed, falling back to per-index calls', err);
            currentAdopters = [];
            for (let i = 0; i < 16; i++) {
                try {
                    const addr = await adoptionContractInstance.methods.adopters(i).call();
                    currentAdopters.push(addr);
                } catch (innerErr) {
                    console.error(`Failed to fetch adopter for index ${i}:`, innerErr);
                    currentAdopters.push('0x0000000000000000000000000000000000000000');
                }
            }
        }

        // Normalize result to array
        let adoptersArray;
        if (Array.isArray(currentAdopters)) {
            adoptersArray = currentAdopters;
        } else if (currentAdopters && typeof currentAdopters === 'object') {
            adoptersArray = Object.values(currentAdopters);
        } else {
            console.error('Unexpected adopters response format:', currentAdopters);
            return;
        }

        const ZERO = '0x0000000000000000000000000000000000000000';

        adoptersArray.forEach((adopterAddress, petId) => {
            const infoContainer = document.querySelector(`[data-adopter-id="${petId}"]`);
            const adoptButton = document.querySelector(`.adopt-btn[data-id="${petId}"]`);

            const adopted = adopterAddress && adopterAddress.toLowerCase() !== ZERO.toLowerCase();

            if (adopted) {
                if (adoptButton) {
                    adoptButton.textContent = 'Permanently Adopted';
                    adoptButton.disabled = true;
                }
                if (infoContainer) {
                    infoContainer.innerHTML = `<div class="adopted-by">Claimed by: <span class="wallet-address-small">${shortAddress(adopterAddress)}</span></div>`;
                    infoContainer.title = adopterAddress;
                }
            } else {
                if (infoContainer) infoContainer.innerHTML = '';
                if (adoptButton) {
                    adoptButton.textContent = 'Adopt Today!';
                    adoptButton.disabled = false;
                }
            }
        });
    } catch (err) {
        console.error('Error fetching adoption statuses:', err);
    }
}

// Handler for adoption button clicks
async function processAdoptionRequest(event) {
    // Use currentTarget to avoid weird event.target behavior
    const btn = event.currentTarget;
    const petIdentifier = parseInt(btn.dataset.id, 10);

    if (Number.isNaN(petIdentifier)) {
        alert('Invalid pet selection.');
        return;
    }

    if (!currentWalletAccount) {
        alert('Please connect your Ethereum wallet before adopting.');
        return;
    }

    if (!adoptionContractInstance) {
        alert('Contract is not initialized. Please connect wallet and ensure you are on Sepolia.');
        return;
    }

    try {
        // Visual feedback
        btn.disabled = true;
        const prevText = btn.textContent;
        btn.textContent = 'Processing...';

        // Send transaction
        const tx = await adoptionContractInstance.methods.adopt(petIdentifier).send({
            from: currentWalletAccount,
            gas: 300000
        });

        console.log('Adoption tx receipt:', tx);

        // Update UI
        btn.textContent = 'Adopted Successfully! 🎉';

        const infoElement = document.querySelector(`[data-adopter-id="${petIdentifier}"]`);
        if (infoElement) {
            infoElement.innerHTML = `<div class="adopted-by">Claimed by: <span class="wallet-address-small">${shortAddress(currentWalletAccount)}</span></div>`;
            infoElement.title = currentWalletAccount;
        }

        alert(`Adoption transaction confirmed! You are the new owner of ${PET_ADOPTION_DATA[petIdentifier].name}.`);

        // Re-sync final statuses
        await fetchAndUpdateAdoptionStatuses();
    } catch (err) {
        console.error('Transaction failed:', err);

        let feedback = 'Transaction failed. ';
        if (err && (err.code === 4001 || (err.message && err.message.toLowerCase().includes('user denied')))) {
            feedback = 'Adoption request was cancelled by the user.';
        } else if (err && err.message && err.message.toLowerCase().includes('insufficient funds')) {
            feedback += 'Insufficient ETH (gas). Please add test ETH to your wallet.';
        } else {
            feedback += 'See console for details.';
        }

        alert(feedback);

        // restore button state
        btn.textContent = 'Adopt Today!';
        btn.disabled = false;
    }
}
