"use client"; // Mark as a Client Component

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
// import Fuse from 'fuse.js'; // Import Fuse.js - Removed

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

// Define the expected structure of a channel object
interface Channel {
  id: number;
  name: string;
  groupTitle: string;
  tvgLogo?: string;
  url: string; // Source URL (not used directly by player)
}

// Define the structure of the API response
interface ApiResponse {
  data: Channel[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

// Available language group prefixes
const AVAILABLE_LANGUAGES = ['EN', 'UK']; // These are the *codes* the user can select

// Mapping from location code to display name
const LOCATION_CODE_MAP: { [key: string]: string } = {
  EN: 'English',
  UK: 'UK & English',
  DE: 'German',
  ES: 'Spanish',
  FR: 'French',
  IT: 'Italian',
  NL: 'Dutch',
  PL: 'Polish',
  PT: 'Portuguese',
  BR: 'Brazil (PT)',
  RU: 'Russian',
  TR: 'Turkish',
  GR: 'Greek',
  AR: 'Arabic',
  IL: 'Hebrew',
  IN: 'Indian',
  PK: 'Pakistan',
  IR: 'Persian',
  JP: 'Japanese',
  KO: 'Korean',
  KU: 'Kurdish',
  PH: 'Philippines',
  SE: 'Swedish',
  NO: 'Norwegian',
  FI: 'Finnish',
  DK: 'Danish',
  IS: 'Icelandic',
  ND: 'Nordic',
  EU: 'European Union',
  LA: 'Latin America',
  QC: 'Québec (FR)',
  MT: 'Malta',
  RO: 'Romanian',
  HU: 'Hungarian',
  ZA: 'South Africa',
  GE: 'Georgian',
  HK: 'Hong Kong',
  KZ: 'Kazakhstan',
  LT: 'Lithuanian',
  MA: 'Malaysia',
  SG: 'Singapore',
  SU: 'Suriname',
  TH: 'Thailand',
  TN: 'Taiwan',
  UZ: 'Uzbekistan',
  VE: 'Venezuela',
  VI: 'Vietnam',
  EX: 'Ex-Yu', // Yugoslavia region
  WW: 'Worldwide',
  XXX: 'Adult',
  OTHER: 'Other',
  // Add more as needed based on codes found in DB
};

export default function Home() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]); // Initialize empty
  const [allGroups, setAllGroups] = useState<string[]>([]); // State for all group titles
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null); // State for selected group filter
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]); // Store results from API
  // const [allChannels, setAllChannels] = useState<Channel[]>([]); // Store all fetched channels - Removed
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [isLoadingInitialState, setIsLoadingInitialState] = useState<boolean>(true); // Loading state for initial status check
  const [globalActiveChannelId, setGlobalActiveChannelId] = useState<number | null>(null); // Track globally active stream

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const backendBaseUrl = apiBaseUrl?.replace('/api', '');

  // Ref for debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch channels from the backend with search and filter
  const fetchFilteredChannels = useCallback(async (
    currentSearchTerm: string,
    currentSelectedLanguages: string[],
    currentSelectedGroup: string | null
  ) => {
    if (!apiBaseUrl) {
      setFilteredChannels([]);
      return;
    }
    setLoading(true);
    setError(null);
    console.log(`Fetching channels with search: "${currentSearchTerm}", languages: [${currentSelectedLanguages.join(', ')}], group: ${currentSelectedGroup}`);

    try {
      const params = new URLSearchParams();
      if (currentSearchTerm) {
        params.append('search', currentSearchTerm);
      }
      if (currentSelectedLanguages.length > 0) {
        params.append('languageGroupPrefixes', currentSelectedLanguages.join(','));
      }
      if (currentSelectedGroup) {
        params.append('group', currentSelectedGroup);
      }
      params.append('limit', '200'); // Fetch a reasonable number of results for display

      const url = `${apiBaseUrl}/channels?${params.toString()}`;
      console.log(`Fetching from URL: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiResponse = await response.json();
      console.log('Received filtered data:', data);
      setFilteredChannels(data.data || []);
    } catch (err) {
      console.error('Error fetching filtered channels:', err);
      let message = 'Unknown error';
      if (err instanceof Error) message = err.message;
      setError(`Failed to fetch channels: ${message}`);
      setFilteredChannels([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Debounced effect for search term changes
  useEffect(() => {
    // Save selected languages to localStorage whenever it changes
    localStorage.setItem('selectedLanguages', JSON.stringify(selectedLanguages));

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new timer
    debounceTimerRef.current = setTimeout(() => {
      fetchFilteredChannels(searchTerm, selectedLanguages, selectedGroup);
    }, 300); // Debounce time: 300ms

    // Cleanup timer on component unmount or dependency change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, selectedLanguages, selectedGroup, fetchFilteredChannels]);

  // Effect to load saved languages from localStorage *after* mount
  useEffect(() => {
    console.log("Component mounted, checking localStorage for languages...");
    const saved = localStorage.getItem('selectedLanguages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) { // Ensure it's an array
            console.log("Found saved languages:", parsed);
            setSelectedLanguages(parsed);
        } else {
            console.warn('Invalid data found in localStorage for languages, resetting.');
            localStorage.removeItem('selectedLanguages');
        }
      } catch (e) {
          console.error('Failed to parse languages from localStorage:', e);
          localStorage.removeItem('selectedLanguages'); // Clear corrupted data
      }
    } else {
      console.log("No saved languages found in localStorage.");
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to fetch initial stream status on load
  useEffect(() => {
    const fetchInitialStatus = async () => {
      if (!apiBaseUrl) {
        setIsLoadingInitialState(false);
        return;
      }
      console.log('Fetching initial stream status...');
      try {
        const statusRes = await fetch(`${apiBaseUrl}/stream/status`);
        if (!statusRes.ok) throw new Error(`Status fetch failed: ${statusRes.status}`);
        const statusData = await statusRes.json();
        console.log('Initial status data:', statusData);

        if (statusData.activeChannelId) {
          const activeId = statusData.activeChannelId;
          setGlobalActiveChannelId(activeId);
          console.log(`Active stream detected: ${activeId}. Fetching channel details...`);

          // Fetch details for the active channel
          const channelRes = await fetch(`${apiBaseUrl}/channels/${activeId}`);
          if (!channelRes.ok) throw new Error(`Channel details fetch failed: ${channelRes.status}`);
          const channelData: Channel = await channelRes.json();
          console.log('Active channel details:', channelData);

          setSelectedChannel(channelData); // Set as selected, this triggers stream URL fetch
        } else {
          console.log('No active stream detected.');
          setGlobalActiveChannelId(null);
        }
      } catch (err) {
        console.error('Error fetching initial stream status or channel details:', err);
        setError('Could not load initial stream status.'); // Inform user
      } finally {
        setIsLoadingInitialState(false);
      }
    };

    fetchInitialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]); // Run only once on mount

  // Temporary effect to fetch and log group titles - Modify to set state
  useEffect(() => {
    const fetchGroups = async () => {
      if (!apiBaseUrl) return;
      try {
        const response = await fetch(`${apiBaseUrl}/channels/groups`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const groups: string[] = await response.json();
        console.log('Available Group Titles:', groups); // Keep log for now
        setAllGroups(groups); // Set the groups state
      } catch (err) {
        console.error('Error fetching group titles:', err);
        setAllGroups([]); // Clear on error
      }
    };
    fetchGroups();
  }, [apiBaseUrl]);

  // --- Remove Fuse.js related code ---
  /*
  // Fetch initial channel list on mount - Removed, fetch happens on search/filter change
  useEffect(() => {
    // fetchChannels(); // Initial fetch removed
  }, []);

  // Client-side fuzzy search using Fuse.js - Removed
  const fuse = useMemo(() => {
      console.log(`Fuse: Creating/recreating instance with ${allChannels.length} channels.`);
      const options: Fuse.IFuseOptions<Channel> = {
          keys: ['name'],
          includeScore: true,
          ignoreLocation: true,
          threshold: 0.5,
      };
      return new Fuse(allChannels, options);
  }, [allChannels]);

  const filteredChannels = useMemo(() => { // Now a direct state variable
      if (!searchTerm) {
          return allChannels;
      }
      // Temporarily use basic includes filter instead of Fuse
      console.log(`Basic Filter: Searching for term: "${searchTerm}" in ${allChannels.length} channels`);
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const results = allChannels.filter(channel =>
          channel.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
      console.log(`Basic Filter: Found ${results.length} results:`, results.map(c => c.name));
      return results;
      /* // Fuse result processing removed
      console.log(`Fuse: Searching for term: "${searchTerm}"`);
      const results = fuse.search(searchTerm);
      console.log('Fuse: Raw search results:', results);
      return results.map((result: Fuse.FuseResult<Channel>) => result.item);
      * /
  }, [searchTerm, allChannels]); // Removed fuse dependency
  */

  // Clear stream when search term or filters change
  useEffect(() => {
      setSelectedChannel(null);
      setStreamUrl(null);
      // Note: fetchFilteredChannels is now called by the debounced effect
  }, [searchTerm, selectedLanguages, selectedGroup]);

  // Effect to fetch and set the stream URL *after* a channel is selected (remains the same)
  useEffect(() => {
    if (!selectedChannel || !backendBaseUrl) {
      return; // No channel selected or backend URL missing
    }
    let isMounted = true;
    const streamApiEndpoint = `${backendBaseUrl}/api/stream/${selectedChannel.id}/playlist.m3u8`;
    const expectedHlsUrlPrefix = `${backendBaseUrl}/hls/${selectedChannel.id}/playlist.m3u8`;
    const loadStream = async () => {
      console.log(`Attempting to initiate stream via: ${streamApiEndpoint}`);
      setIsLoadingStream(true);
      setStreamUrl(null);
      setError(null);
      try {
        const response = await fetch(streamApiEndpoint, { method: 'GET', cache: 'no-store' });
        console.log('Stream API Response Status:', response.status);
        console.log('Stream API Response URL (after redirects):', response.url);
        if (response.ok && response.url.startsWith(expectedHlsUrlPrefix)) {
           if (isMounted) {
                console.log(`Stream ready, setting player URL to: ${response.url}`);
                setStreamUrl(response.url);
           }
        } else {
             const errorText = response.statusText || `status ${response.status}`;
             throw new Error(`Backend did not provide a valid stream playlist. ${errorText}`);
        }
      } catch (err) {
        console.error('Failed to load stream:', err);
        if (isMounted) {
            let message = 'Unknown error';
            if (err instanceof Error) message = err.message;
            setError(`Failed to load stream: ${message}`);
            setStreamUrl(null);
        }
      } finally {
          if (isMounted) {
            setIsLoadingStream(false);
          }
      }
    };
    loadStream();
    return () => {
        isMounted = false;
    };
  }, [selectedChannel, backendBaseUrl]);

  // Handle channel selection (remains the same)
  const handleSelectChannel = (channel: Channel) => {
    // --- MODIFIED LOGIC: Prevent selection if global stream is active and different ---
    if (globalActiveChannelId !== null && globalActiveChannelId !== channel.id) {
        console.log(`Channel selection blocked: Stream ${globalActiveChannelId} is already active.`);
        // Optionally, provide feedback to the user
        setError(`Another stream (${globalActiveChannelId}) is currently active. Please join that stream or wait.`);
        // Or, force selection of the active channel
        // if (selectedChannel?.id !== globalActiveChannelId) { 
        //    console.log(`Redirecting selection to active channel: ${globalActiveChannelId}`);
        //    // Find the active channel details from filteredChannels or fetch again if needed
        // } 
        return; // Prevent selecting a different channel
    }
    // --- END MODIFIED LOGIC ---

    // Original logic: Only update state if the channel is actually different
    // This is now only reachable if globalActiveChannelId is null OR channel.id matches globalActiveChannelId
    if (selectedChannel?.id !== channel.id) {
        console.log(`Selecting channel: ${channel.name} (ID: ${channel.id})`);
        setSelectedChannel(channel);
        setError(null); // Clear previous errors on new selection
    }
  };

  // Handle language checkbox change
  const handleLanguageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value, checked } = event.target;
      setSelectedLanguages(prev =>
          checked ? [...prev, value] : prev.filter(lang => lang !== value)
      );
      // Fetching is triggered by the useEffect watching selectedLanguages
  };

  // Handle group selection change
  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const group = event.target.value;
    setSelectedGroup(group === "" ? null : group); // Set to null if 'All Categories' is chosen
    // Fetching is triggered by the useEffect watching selectedGroup
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4 text-center">M3U Restreamer</h1>

      {/* Search Input & Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
         {/* Search Input */}
        <input
          type="text"
          id="channel-search"
          name="channelSearch"
          placeholder="Search channels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow p-2 border border-gray-300 rounded text-black dark:text-white dark:bg-gray-700 dark:border-gray-600 min-w-0"
        />
         {/* Language Filters */}
         <div className="flex items-center space-x-4 text-black dark:text-white">
             <span className="font-medium">Groups:</span>
             {AVAILABLE_LANGUAGES.map(langCode => (
                 <label key={langCode} className="flex items-center space-x-1 cursor-pointer">
                     <input
                         type="checkbox"
                         id={`lang-${langCode}`}
                         name="languageFilter"
                         value={langCode}
                         checked={selectedLanguages.includes(langCode)}
                         onChange={handleLanguageChange}
                         className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                     />
                     <span>{LOCATION_CODE_MAP[langCode] || langCode}</span>
                 </label>
             ))}
         </div>
         {/* Category Filter Dropdown */}
         <div className="text-black dark:text-white">
             <select
                 id="category-filter"
                 name="categoryFilter"
                 value={selectedGroup || ""}
                 onChange={handleGroupChange}
                 className="p-2 border border-gray-300 rounded text-black dark:text-white dark:bg-gray-700 dark:border-gray-600"
             >
                 <option value="">All Categories</option>
                 {[...new Set(allGroups)].map(group => (
                     <option key={group} value={group}>{group}</option>
                 ))}
             </select>
         </div>
      </div>


      {/* Main Layout: Channel List & Player */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Channel List */}
        <div className={`md:col-span-1 bg-gray-100 p-4 rounded shadow overflow-y-auto h-[70vh] ${globalActiveChannelId !== null ? 'opacity-75 pointer-events-none' : ''}`}>
          <h2 className="text-lg font-semibold mb-3 text-gray-800">Channels</h2>
          {isLoadingInitialState && <p className="text-gray-600">Checking stream status...</p>}
          {loading && <p className="text-gray-600">Loading results...</p>}
          {error && <p className="text-red-500">Error: {error}</p>}
          {!loading && !error && filteredChannels.length === 0 && (searchTerm || selectedLanguages.length > 0 || selectedGroup) && (
            <p className="text-gray-600">No channels found matching your criteria.</p>
          )}
           {!loading && !error && filteredChannels.length === 0 && !searchTerm && selectedLanguages.length === 0 && !selectedGroup && (
             <p className="text-gray-600">Enter search term or select groups.</p>
           )}
          <ul className="space-y-2">
            {/* Now iterating over filteredChannels directly */}
            {filteredChannels.map((channel: Channel) => (
              <li
                key={channel.id}
                onClick={() => handleSelectChannel(channel)}
                className={`p-2 rounded cursor-pointer hover:bg-blue-100 text-sm text-gray-700 ${selectedChannel?.id === channel.id ? 'bg-blue-200 font-medium' : 'bg-white'}`}
              >
                <div className="flex items-center space-x-2">
                    {channel.tvgLogo && (
                        <img
                            src={channel.tvgLogo}
                            alt="logo"
                            className="w-5 h-5 object-contain flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                    )}
                     <span className="flex-grow truncate" title={channel.name}>{channel.name}</span>
                </div>
                 <p className="text-xs text-gray-500 ml-7 truncate" title={channel.groupTitle}>{channel.groupTitle}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Video Player (remains the same) */}
        <div className="md:col-span-2 bg-black rounded shadow flex items-center justify-center h-[70vh]">
          {isLoadingInitialState && <p className="text-gray-400 text-center">Checking stream status...</p>}
          {isLoadingStream && (
             <p className="text-gray-400 text-center">Loading stream...</p>
          )}
          {!isLoadingStream && streamUrl && (
            <ReactPlayer
              key={streamUrl}
              url={streamUrl}
              playing={true}
              controls={true}
              width="100%"
              height="100%"
              onError={(e, data, instance, hlsInstance) => {
                 const _unusedData = data;
                 const _unusedInstance = instance;
                 const _unusedHlsInstance = hlsInstance;
                 console.error('ReactPlayer Error Event:', e);
                 console.error('ReactPlayer Error Data:', data);
                 setError(`Player error: ${e?.type || 'Unknown error'}. Check console for details.`);
                 setStreamUrl(null);
              }}
              config={{
                 file: {
                   forceHLS: true,
                   hlsOptions: {
                     debug: false
                   }
                 }
              }}
            />
          )}
          {!isLoadingStream && !streamUrl && (
            <p className="text-gray-400 text-center">
              {error ? `Error: ${error}` : (selectedChannel ? 'Failed to load stream.' : 'Select a channel to play')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
