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
const MAINTENANCE_EMAIL = 'udeep.singh@timhortonsindia.com';

// Regional maintenance leads — CC'd when their region's stores raise tickets
const MAINTENANCE_REGION_EMAILS = {
  'Raman':            'saif.ali@timhortonsindia.com',
  'Harish':           'saif.ali@timhortonsindia.com',
  'Rohit':            'saif.ali@timhortonsindia.com',
  'Kajal':            'amanaggarwal666@gmail.com',
  'Deepak':           'amanaggarwal666@gmail.com',
  'Jagadeesha':       'Basalingayya.Kulkarni@timhortonsindia.com',
  'Shivam':           'Basalingayya.Kulkarni@timhortonsindia.com',
  'Sandeep Mukharjee':'sandesh.gavade@timhortonsindia.com',
  'Akash Rathod':     'sandesh.gavade@timhortonsindia.com',
  'TBA':              'sandesh.gavade@timhortonsindia.com',
  'Unassigned':       'sandesh.gavade@timhortonsindia.com'
};
const P1_ESCALATION_EMAILS = ['jeenal.kapasi@timhortonsindia.com', 'vivek.agarwal@timhortonsindia.com'];

module.exports = { AM_EMAILS, CC_EMAIL, HOD_EMAIL, CEO_EMAIL, TRAINING_EMAIL, MAINTENANCE_EMAIL, MAINTENANCE_REGION_EMAILS, P1_ESCALATION_EMAILS };
