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
        "inputs": [
            {
                "internalType": "uint256",
                "name": "petId",
                "type": "uint256"
            }
        ],
        "name": "adopt",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "adopters",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAdopters",
        "outputs": [
            {
                "internalType": "address[16]",
                "name": "",
                "type": "address[16]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Deployed contract address on the target network
const CONTRACT_DEPLOYED_ADDRESS = "0xfcC2dBA3D7663F40d75Ca119dbE79f94B064BBFd";

// Network constants
const TARGET_CHAIN_ID_HEX = '0xaa36a7'; // Sepolia Chain ID (11155111)
const TARGET_NETWORK_NAME = 'Sepolia Testnet';

let currentWeb3Instance;
let adoptionContractInstance;
let currentWalletAccount;

// Initialize dApp on page load
window.addEventListener('load', async () => {
    // 1. Render the pets inventory
    renderAllPetCards();

    // 2. Initial MetaMask check
    if (typeof window.ethereum !== 'undefined') {
        console.info('Ethereum provider (MetaMask) detected!');
    } else {
        alert('MetaMask or a compatible Ethereum wallet is required to use this decentralized application!');
    }
});

// Utility function to switch to the Sepolia network
async function ensureSepoliaNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: TARGET_CHAIN_ID_HEX }],
        });
        return true;
    } catch (switchError) {
        // Error code 4902 means the chain hasn't been added to MetaMask
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: TARGET_CHAIN_ID_HEX,
                            chainName: TARGET_NETWORK_NAME,
                            nativeCurrency: {
                                name: 'Sepolia ETH', // Slightly changed name
                                symbol: 'ETH',
                                decimals: 18,
                            },
                            rpcUrls: ['https://sepolia.infura.io/v3/'], // Retained the specific URL
                            blockExplorerUrls: ['https://sepolia.etherscan.io'],
                        },
                    ],
                });
                return true;
            } catch (addError) {
                console.error('Failed to add Sepolia network definition:', addError);
                return false;
            }
        }
        console.error('Error during network switch attempt:', switchError);
        return false;
    }
}

// Check the current network ID against the target network ID
async function verifyCurrentNetwork() {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    return currentChainId === TARGET_CHAIN_ID_HEX;
}

// Connect Wallet Button Handler
document.getElementById('connectButton').addEventListener('click', async () => {
    try {
        // Request connection and get accounts
        const accountsList = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentWalletAccount = accountsList[0];

        // Network Check and Switch Flow
        const isTargetNetwork = await verifyCurrentNetwork();
        if (!isTargetNetwork) {
            const shouldAttemptSwitch = confirm(
                `The dApp is configured for the ${TARGET_NETWORK_NAME}. ` +
                `Click OK to prompt an automatic switch in MetaMask.`
            );
            if (shouldAttemptSwitch) {
                const successfullySwitched = await ensureSepoliaNetwork();
                if (!successfullySwitched) {
                    alert(`Please manually switch to ${TARGET_NETWORK_NAME} in your wallet.`);
                    return;
                }
                // Small delay to allow MetaMask to process the chain switch
                await new Promise(res => setTimeout(res, 1000));
            } else {
                alert(`Cannot proceed without connecting to the ${TARGET_NETWORK_NAME}.`);
                return;
            }
        }

        // Initialize Web3 and Contract Instances
        currentWeb3Instance = new Web3(window.ethereum);
        adoptionContractInstance = new currentWeb3Instance.eth.Contract(ADOPTION_CONTRACT_ABI, CONTRACT_DEPLOYED_ADDRESS);

        // Update User Interface State
        document.getElementById('accountDisplay').textContent =
            `Active Wallet: ${currentWalletAccount.substring(0, 6)}...${currentWalletAccount.substring(38)} (${TARGET_NETWORK_NAME})`;
        document.getElementById('connectButton').textContent = 'Wallet Connected';
        document.getElementById('connectButton').disabled = true;

        // Fetch and update adoption statuses from the smart contract
        await fetchAndUpdateAdoptionStatuses();

        // Set up event listener for network changes (requires full refresh for robust dApp behavior)
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });

    } catch (connectionError) {
        console.error('Fatal error during MetaMask connection sequence:', connectionError);
        alert('Failed to connect the wallet. Check the console for details.');
    }
});

// Function responsible for generating the pet cards on the page
function renderAllPetCards() {
    const containerElement = document.getElementById('petsRow');

    PET_ADOPTION_DATA.forEach((petDetails, petIndex) => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'pet-card';
        cardWrapper.innerHTML = `
            <img class="pet-image" src="images/pet-${petIndex}.jpeg" alt="${petDetails.name}" onerror="this.src='https://via.placeholder.com/200x200.png?text=Pet+${petIndex + 1}'">
            <div class="pet-name">${petDetails.name}</div>
            <div class="pet-breed">${petDetails.breed}</div>
            <div class="pet-age">Approx. Age: ${petDetails.age}</div>
            <div class="adopter-info" data-adopter-id="${petIndex}"></div>
            <button class="adopt-btn" data-id="${petIndex}">Adopt Today!</button>
        `; // Minor text/attribute changes
        containerElement.appendChild(cardWrapper);
    });

    // Attach event listeners to all adoption buttons
    document.querySelectorAll('.adopt-btn').forEach(button => {
        button.addEventListener('click', processAdoptionRequest);
    });
}

// Fetches the adoption status from the blockchain and updates the UI
async function fetchAndUpdateAdoptionStatuses() {
    if (!adoptionContractInstance) {
        console.warn('Contract instance is not available for status check.');
        return;
    }

    try {
        let currentAdopters;

        // Strategy 1: Try batch retrieval via getAdopters()
        try {
            currentAdopters = await adoptionContractInstance.methods.getAdopters().call();
            console.log('Batch retrieval (getAdopters) success:', currentAdopters);
        } catch (e) {
            // Strategy 2: Fallback to individual calls if batch fails
            console.warn('Batch retrieval failed, falling back to 16 individual calls...', e);
            currentAdopters = [];
            for (let i = 0; i < 16; i++) {
                try {
                    const adopterAddress = await adoptionContractInstance.methods.adopters(i).call();
                    currentAdopters.push(adopterAddress);
                } catch (err) {
                    console.error(`Error checking status for pet index ${i}:`, err);
                    currentAdopters.push('0x0000000000000000000000000000000000000000'); // Default to zero address on error
                }
            }
        }

        // Normalize the result into an array if necessary (handles web3.js return format variations)
        let normalizedAdoptersArray;
        if (Array.isArray(currentAdopters)) {
            normalizedAdoptersArray = currentAdopters;
        } else if (typeof currentAdopters === 'object' && currentAdopters !== null) {
            normalizedAdoptersArray = Object.values(currentAdopters);
        } else {
            console.error('Adoption status data received in an unexpected format:', currentAdopters);
            return;
        }

        console.log('Final array of adopters being processed:', normalizedAdoptersArray);

        normalizedAdoptersArray.forEach((adopterAddress, petId) => {
            const infoContainer = document.querySelector(`[data-adopter-id="${petId}"]`);
            const adoptButton = document.querySelector(`[data-id="${petId}"]`);

            // Check for valid adoption address (non-zero and non-empty)
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            const isPetAdopted = adopterAddress &&
                adopterAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

            if (isPetAdopted) {
                // Update UI elements for adopted pet
                if (adoptButton) {
                    adoptButton.textContent = 'Permanently Adopted'; // Minor text change
                    adoptButton.disabled = true;
                }

                if (infoContainer) {
                    // Display truncated adopter wallet address
                    const shortAddr = `${adopterAddress.substring(0, 6)}...${adopterAddress.substring(38)}`;
                    infoContainer.innerHTML = `<div class="adopted-by">Claimed by: <span class="wallet-address-small">${shortAddr}</span></div>`; // Minor CSS class/text change
                    infoContainer.title = adopterAddress; // Full address on hover
                }
            } else {
                // Ensure UI is clean for unadopted pets
                if (infoContainer) {
                    infoContainer.innerHTML = '';
                }
                if (adoptButton) {
                    adoptButton.textContent = 'Adopt Today!'; // Reset button text
                    adoptButton.disabled = false;
                }
            }
        });
    } catch (statusError) {
        console.error('Critical Error loading adoption statuses:', statusError);
    }
}

// Handles the transaction submission for pet adoption
async function processAdoptionRequest(event) {
    const petIdentifier = parseInt(event.target.dataset.id);

    if (!currentWalletAccount) {
        alert('Action Required: Please connect your Ethereum wallet before adopting!');
        return;
    }

    try {
        // Provide immediate visual feedback and disable button
        event.target.textContent = 'Processing...';
        event.target.disabled = true;

        // Execute the smart contract transaction
        await adoptionContractInstance.methods.adopt(petIdentifier).send({
            from: currentWalletAccount,
            gas: 300000 // Fixed gas limit for simplicity
        });

        // Success feedback
        event.target.textContent = 'Adopted Successfully! 🎉';

        // Update adopter info locally for immediate display
        const infoElement = document.querySelector(`[data-adopter-id="${petIdentifier}"]`);
        if (infoElement) {
            const shortAddr = `${currentWalletAccount.substring(0, 6)}...${currentWalletAccount.substring(38)}`;
            infoElement.innerHTML = `<div class="adopted-by">Claimed by: <span class="wallet-address-small">${shortAddr}</span></div>`;
            infoElement.title = currentWalletAccount;
        }

        alert(`Adoption transaction confirmed! You are the new owner of ${PET_ADOPTION_DATA[petIdentifier].name}.`);

        // Final status sync
        await fetchAndUpdateAdoptionStatuses();

    } catch (transactionError) {
        console.error('Transaction Failed or Denied:', transactionError);

        let feedbackMessage = 'Transaction failed. ';
        if (transactionError.code === 4001 || transactionError.message?.includes('User denied')) {
            feedbackMessage = 'Adoption request was cancelled by the user.';
        } else if (transactionError.message?.includes('insufficient funds')) {
            feedbackMessage += 'Insufficient ETH (gas) in your wallet. Please acquire test ETH.';
        } else {
            feedbackMessage += 'An unknown error occurred. Please review the console.';
        }

        alert(feedbackMessage);

        // Reset button state
        event.target.textContent = 'Adopt Today!';
        event.target.disabled = false;
    }
}