'use strict';
const Joi = require('joi');

function validate(schema, source = 'body') {
  return function(req, res, next) {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map(function(d) { return d.message; });
      return res.status(400).json({ success: false, error: messages.join('; ') });
    }
    req[source] = value;
    next();
  };
}

const schemas = {
  pin: Joi.object({
    pin: Joi.string().pattern(/^\d{4}$/).required().messages({
      'string.pattern.base': 'PIN must be 4 digits',
      'any.required': 'PIN is required'
    })
  }),

  submission: Joi.object({
    am: Joi.string().min(1).max(50).required(),
    store: Joi.string().min(1).max(100).required(),
    day: Joi.string().valid('monday','tuesday','wednesday','thursday','friday','saturday','sunday').required(),
    score: Joi.number().integer().min(0).max(100).optional(),
    date: Joi.date().iso().optional(),
    notes: Joi.string().max(2000).optional().allow(''),
    machines: Joi.array().items(Joi.object({
      machine: Joi.string().optional(),
      status: Joi.string().optional()
    })).optional(),
    region: Joi.string().max(100).optional().allow(''),
    answers: Joi.any().optional(),
    comments: Joi.any().optional(),
    ciCall: Joi.string().max(20).optional().allow(''),
    complaints: Joi.number().integer().min(0).optional(),
    complaintCategory: Joi.string().max(50).optional().allow(''),
    resolution: Joi.string().max(20).optional().allow(''),
    hodSupport: Joi.any().optional(),
    weekendReadiness: Joi.any().optional(),
    landlord: Joi.any().optional(),
    visitDate: Joi.any().optional()
  }).unknown(true),

  post: Joi.object({
    author: Joi.string().min(1).max(50).required(),
    caption: Joi.string().min(1).max(5000).required().messages({
      'string.max': 'Caption must be under 5000 characters'
    }),
    category: Joi.string().valid('recognition','celebration','bestpractice','coffee','teamwin','leaderboard','learning','other').optional(),
    store: Joi.string().max(100).optional().allow(''),
    photo: Joi.string().max(500).optional().allow(''),
    taggedPerson: Joi.string().max(50).optional().allow('')
  }),

  postEdit: Joi.object({
    postId: Joi.string().required(),
    caption: Joi.string().min(1).max(5000).required()
  }),

  comment: Joi.object({
    postId: Joi.string().required(),
    comment: Joi.object({
      author: Joi.string().min(1).max(50).required(),
      text: Joi.string().min(1).max(2000).required()
    }).required()
  }),

  commentEdit: Joi.object({
    postId: Joi.string().required(),
    commentIdx: Joi.number().integer().min(0).required(),
    text: Joi.string().max(2000).optional().allow(''),
    action: Joi.string().valid('edit', 'delete').optional()
  }),

  task: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(2000).optional().allow(''),
    store: Joi.string().max(100).optional().allow(''),
    am: Joi.string().max(50).optional().allow(''),
    priority: Joi.string().valid('P1', 'P2', 'P3').optional(),
    dueDate: Joi.date().iso().optional()
  }),

  taskUpdate: Joi.object({
    title: Joi.string().max(200).optional(),
    description: Joi.string().max(2000).optional().allow(''),
    priority: Joi.string().valid('P1', 'P2', 'P3').optional(),
    dueDate: Joi.date().iso().optional(),
    status: Joi.string().valid('open', 'in_progress', 'blocked', 'resolved').optional()
  }),

  event: Joi.object({
    am: Joi.string().min(1).max(50).required(),
    store: Joi.string().min(1).max(100).required(),
    eventDate: Joi.date().iso().required(),
    venue: Joi.string().min(1).max(200).required(),
    menuPricing: Joi.string().max(100).required(),
    salesGenerated: Joi.number().min(0).required(),
    revenueShare: Joi.number().min(0).max(100).required(),
    otherExpenses: Joi.number().min(0).required(),
    manualBillBook: Joi.string().valid('yes', 'no').required(),
    manualBillBookComment: Joi.string().max(500).optional().allow(''),
    punchedInSystem: Joi.string().valid('yes', 'no').required(),
    punchedInSystemComment: Joi.string().max(500).optional().allow(''),
    billsAttached: Joi.string().valid('yes', 'no').required(),
    billsAttachedComment: Joi.string().max(500).optional().allow(''),
    managerPresent: Joi.string().valid('yes', 'no').required(),
    notes: Joi.string().max(2000).optional().allow('')
  }),

  eventQuick: Joi.object({
    am: Joi.string().min(1).max(50).required(),
    store: Joi.string().min(1).max(100).required(),
    eventName: Joi.string().min(1).max(200).required(),
    eventDate: Joi.date().iso().required(),
    salesGenerated: Joi.number().min(0).required(),
    revenueShare: Joi.number().min(0).max(100).optional(),
    otherExpenses: Joi.number().min(0).optional(),
    notes: Joi.string().max(2000).optional().allow('')
  }),

  fduSubmit: Joi.object({
    store: Joi.string().min(1).max(100).required(),
    am: Joi.string().min(1).max(50).required()
  }),

  donutSubmit: Joi.object({
    store: Joi.string().min(1).max(100).required(),
    am: Joi.string().min(1).max(50).required()
  }),

  audit: Joi.object({
    store: Joi.string().min(1).max(100).required(),
    cycle: Joi.string().max(50).required(),
    type: Joi.string().max(50).required()
  }),

  cashAudit: Joi.object({
    store: Joi.string().min(1).max(100).required(),
    monthYear: Joi.string().pattern(/^\d{4}-\d{2}$/).required().messages({
      'string.pattern.base': 'monthYear must be YYYY-MM format'
    }),
    storeCode: Joi.string().max(20).optional(),
    areaManager: Joi.string().max(50).optional(),
    storeManager: Joi.string().max(50).optional(),
    region: Joi.string().max(50).optional(),
    checkpoints: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      desc: Joi.string().required(),
      status: Joi.string().valid('Compliant', 'Non-Compliant', 'N/A').required(),
      remarks: Joi.string().max(500).optional().allow('')
    })).optional(),
    signoff: Joi.object({
      smName: Joi.string().max(50).optional().allow(''),
      amName: Joi.string().max(50).optional().allow(''),
      rhName: Joi.string().max(50).optional().allow('')
    }).optional()
  }),

  presence: Joi.object({
    name: Joi.string().min(1).max(50).required()
  }),

  pushSend: Joi.object({
    am: Joi.string().max(50).optional().allow(null),
    title: Joi.string().min(1).max(200).required(),
    body: Joi.string().max(500).required(),
    url: Joi.string().max(500).optional(),
    tag: Joi.string().max(50).optional()
  })
};

module.exports = { validate, schemas };
