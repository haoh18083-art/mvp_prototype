(function(SC,B){
  const render=B.customerView();
  B.mount({pid:"P-CMN-03",title:"客户档案",menu:B.role==="ADM"?"allcust":B.role==="SOL"?"mypool":"mycust",shared:true,
    crumb:B.role==="ADM"?[{t:"全量客户查看",href:"customers.html"}]:[]},render);
})(window.SC,window.SC.B2);
