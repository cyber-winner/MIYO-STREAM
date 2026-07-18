import React, { createContext, useContext, useState, useEffect } from 'react';
const DeviceContext = createContext({
  deviceType: 'desktop',
  isMobile: false,
  isDesktop: true,
  isTv: false,
});
function detectDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 768) return 'mobile';
  return 'desktop';
}
export function DeviceProvider({ children }) {
  const [deviceType, setDeviceType] = useState(() => detectDeviceType());
  useEffect(() => {
    const handleResize = () => {
      setDeviceType(detectDeviceType());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const value = {
    deviceType,
    isMobile: deviceType === 'mobile',
    isDesktop: deviceType === 'desktop',
    isTv: deviceType === 'tv',
  };
  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}
export function useDevice() {
  return useContext(DeviceContext);
}
export default DeviceContext;