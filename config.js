'use strict';
// Where the online part of Daily Drum lives (accounts, friends, saved progress).
// The key below is the "publishable" key: it is meant to be public and only lets the app call the functions in
// supabase-setup.sql, each of which checks a login. Never put a "secret" or "service role" key in this file.
const DD = {
  url: 'https://voopwbweafvjdtufugll.supabase.co',
  key: 'sb_publishable_Ah8h78N-uiGCS_dyEqAP4Q_opxhirjb'
};
const Net = {
  base: (() => { try { return localStorage.getItem('dd.api') || DD.url + '/rest/v1'; } catch (e) { return DD.url + '/rest/v1'; } })(),
  async rpc(fn, args) {
    const r = await fetch(this.base + '/rpc/' + fn, {
      method: 'POST', headers: { apikey: DD.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {})
    });
    if (!r.ok) throw new Error('The online service answered ' + r.status);
    return r.json();
  }
};
