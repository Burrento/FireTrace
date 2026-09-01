/* BFP Calapan's contact details, in one place.

   The Home screen's call button used to dial a hardcoded +639171234567 while
   the Official BFP Contacts page listed (043) 288-2430 -- two different numbers
   for the same station, one of them a placeholder. A call button that reaches a
   stranger during a fire is worse than no call button, so both screens now read
   from here and cannot disagree.

   `BFP_HOTLINE` is in E.164 because that is what a `tel:` link should carry:
   +63 works whether the phone is roaming, on a mobile network, or has no area
   code configured. The display strings are the human-readable versions. */

export const BFP_HOTLINE = '+63432882430';
export const BFP_HOTLINE_DISPLAY = '(043) 288-2430';

export const BFP_STATION = {
    name: 'BFP – Calapan City Fire Station',
    contacts: [
        { label: 'Emergency Hotline', value: BFP_HOTLINE_DISPLAY, tel: BFP_HOTLINE },
        { label: 'Hotline 2', value: '(043) 288-2431', tel: '+63432882431' },
        { label: 'Text / SMS', value: '0917-123-4567', sms: '+639171234567' },
        { label: 'Email', value: 'bfpcalapan@email.com', mail: 'bfpcalapan@email.com' },
        { label: 'Facebook Page', value: 'BFP Calapan City Fire Station (Official)' },
    ],
};
