'use strict';

const AM_EMAILS = {
  'Raman':       'raman.kumar@timhortonsindia.com',
  'Harish':      'harish.solanki@timhortonsindia.com',
  'Rohit':       'rohit.gupta@timhortonsindia.com',
  'Deepak':      'deepak.kumar@timhortonsindia.com',
  'Sandeep Mukharjee':'sandeep.mukharjee@timhortonsindia.com',
  'Akash Rathod':'akash.rathod@timhortonsindia.com',
  'Jagadeesha':  'jagadeesha.shetty@timhortonsindia.com',
  'Shivam':      'shivam.singh@timhortonsindia.com',
  'Kajal':       'kajal.sharma@timhortonsindia.com',
  'TBA':         null,
  'Vrunda':      'trainingcentre.west@timhortonsindia.com'
};

const CC_EMAIL   = 'sandeep.yadav@timhortonsindia.com';
const HOD_EMAIL  = 'jahid.inamdar@timhortonsindia.com';
const CEO_EMAIL  = 'tarun.jain@timhortonsindia.com';
const TRAINING_EMAIL = 'trainingcentre.west@timhortonsindia.com';

const PIN_MAP = {
  '1040': { am: 'Raman',             role: 'am'  },
  '1778': { am: 'Harish',            role: 'am'  },
  '2517': { am: 'Rohit',             role: 'am'  },
  '3253': { am: 'Deepak',            role: 'am'  },
  '3990': { am: 'Sandeep Mukharjee', role: 'am'  },
  '4727': { am: 'Akash Rathod',      role: 'am'  },
  '5463': { am: 'Jagadeesha',        role: 'am'  },
  '6200': { am: 'Shivam',            role: 'am'  },
  '6937': { am: 'Kajal',             role: 'am'  },
  '7673': { am: 'Vrunda',            role: 'am'  },
  '8410': { am: 'Jahid',             role: 'hod' },
  '9147': { am: 'Tarun',             role: 'ceo' }
};

module.exports = { AM_EMAILS, CC_EMAIL, HOD_EMAIL, CEO_EMAIL, TRAINING_EMAIL, PIN_MAP };
