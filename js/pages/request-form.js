// Compatibility entry for the SLS drawer workflow.
(function(){
 const q=new URLSearchParams(location.search),id=q.get('id');q.delete('id');
 if(!q.has('role'))q.set('role','SLS');
 q.set('panel','form');
 const host=['new','release','restore','dispute'].includes(q.get('type'))?'my-customers':'market';
 location.replace(host+'.html?'+q);
})();
