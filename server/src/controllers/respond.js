'use strict';
const ok = (res, data, status = 200) => res.status(status).json({ data });
const paged = (res, result) => res.json({ data: result.data, pagination: result.pagination });
module.exports = { ok, paged };
