/**
 * Custom Alert Utility
 * 
 * This utility provides a custom alert dialog that works consistently across all browsers,
 * including Chrome where native alert() may be blocked.
 * 
 * Usage in a component:
 * 
 * import { useCustomAlert } from '@/components/CustomAlert';
 * 
 * function MyComponent() {
 *   const { showAlert, AlertComponent } = useCustomAlert();
 *   
 *   const handleClick = () => {
 *     showAlert('Your message here');
 *   };
 *   
 *   return (
 *     <>
 *       {AlertComponent}
 *       <button onClick={handleClick}>Show Alert</button>
 *     </>
 *   );
 * }
 */

export { CustomAlert, useCustomAlert } from './CustomAlert';
