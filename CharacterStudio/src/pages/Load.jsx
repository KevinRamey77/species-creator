import React, { useEffect, useState } from 'react';
import styles from './Load.module.css';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from "@web3-react/injected-connector"
import { ViewContext, ViewMode } from '../context/ViewContext';
import { SceneContext } from '../context/SceneContext';

import { SoundContext } from "../context/SoundContext"
import { AudioContext } from "../context/AudioContext"

function Load() {
    const { account, library, activate } = useWeb3React();
    const [characters, setCharacters] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const { setViewMode } = React.useContext(ViewContext);
    const { characterManager } = React.useContext(SceneContext);
    const { playSound } = React.useContext(SoundContext)
    const { isMute } = React.useContext(AudioContext)

    const injectedConnector = new InjectedConnector({
        supportedChainIds: [137, 1, 3, 4, 5, 42, 97],
      })
    
    useEffect(() => {
        if (account && library) {
            const loadWalletCharacters = async () => {
            const contractAddress = '0x69341F01C2113E2d09Cd4837bbF1786dfbBc41d7';
            const abi = [
                'function balanceOf(address owner) external view returns (uint256)',
                'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
                'function tokenURI(uint256 tokenId) external view returns (string)',
            ];
            const contract = new ethers.Contract(contractAddress, abi, library);
                try {
                    const balance = await contract.balanceOf(account);
                    const tokenIds = await Promise.all(
                        Array.from({ length: Number(balance) }, (_, index) =>
                            contract.tokenOfOwnerByIndex(account, index)
                        )
                    );
                    const values = await Promise.all(tokenIds.map((tokenId) => contract.tokenURI(tokenId)));
                    setCharacters(values);
                } catch {
                    setError("Unable to load characters from this wallet.");
                }
            };

            loadWalletCharacters();
        }
    }, [account, library]);

    const connectWallet = () => {
        activate(injectedConnector)
    }

    const loadCharacter = async (character) => {
        setError("");
        setIsLoading(true);
        try {
            const response = await fetch(character);
            if (!response.ok) {
                throw new Error(`Metadata request failed with status ${response.status}`);
            }
            const metadata = await response.json();
            await characterManager.loadTraitsFromNFTObject(metadata);
            setViewMode(ViewMode.APPEARANCE);
            !isMute && playSound('backNextButton');
        } catch (loadError) {
            setError(loadError.message || "Unable to load this character.");
        } finally {
            setIsLoading(false);
        }
    }

    const back = () => {
        setViewMode(ViewMode.LANDING)
        !isMute && playSound('backNextButton');
    }

    return (
        <div className={styles.container}>
        {/* if the user has not logged in, display a message */}
            {!account && (
                <div className={styles.message}>
                    <p>Please connect your wallet to load your characters.</p>
                    {/* show connect button */}
                    <button className={styles.button} onClick={() => connectWallet()}>Connect</button>
                </div>
            )}
            <div className={styles.characterContainer}>
                <div className={styles.title}>Load Character</div>
                {isLoading && <div className={styles.message}>Loading character metadata...</div>}
                {error && <div className={styles.error}>{error}</div>}
                {!isLoading && account && characters.length === 0 && !error && (
                    <div className={styles.message}>No characters were found in this wallet.</div>
                )}
                {characters.map((character, i) => {
                    return (
                        <div
                            key={i}
                                className={styles.character}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Load character ${i + 1}`}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            loadCharacter(character);
                                        }
                                    }}
                                    onClick={()=> {loadCharacter(character)}}
                                    >
                            Character {i + 1}
                        </div>
                    );
                })}
            </div>
                {/* show back button to return to landing page */}
            <button className={styles.button} onClick={() => back()}>Back</button>
        </div>
    );
}

export default Load;