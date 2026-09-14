// Compatibility entry for the SLS drawer workflow.
(function(){
 const q=new URLSearchParams(location.search),id=q.get('id');q.delete('id');
 if(!q.has('role'))q.set('role','SLS');
 if(id)q.set('request',id);
 const host='my-requests';
 location.replace(host+'.html?'+q);
})();
