// Compatibility entry for the SLS drawer workflow.
(function(){
 const q=new URLSearchParams(location.search),id=q.get('id');q.delete('id');
 if(!q.has('role'))q.set('role','SLS');
 q.set('panel','sea');if(id)q.set('detail',id);q.set('view','sea');
 const host='market';
 location.replace(host+'.html?'+q);
})();
