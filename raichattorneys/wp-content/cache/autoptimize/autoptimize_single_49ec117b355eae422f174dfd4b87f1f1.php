jQuery(document).ready(function(){if(sgclicks.data){var targets=sgclicks.data.sg_click_data;for(var key in targets){if(targets.hasOwnProperty(key)){get_targeted_links(targets[key].target,targets[key].type);}}}});if(document.getElementsByClassName===undefined){document.getElementsByClassName=function(className){var hasClassName,allElements,results,element;hasClassName=new RegExp("(?:^|\\s)"+className+"(?:$|\\s)");allElements=document.getElementsByTagName("*");results=[];for(var i=0;(element=allElements[i])!==null;i++){var elementClass=element.className;if(elementClass&&elementClass.indexOf(className)!=-1&&hasClassName.test(elementClass)){results.push(element);}}
return results;};}
function save_click(element,target,type){var now,then,data,destination,origin;now=new Date();origin=(window.decode)?window.decodeURI(document.URL):document.URL;if(typeof element.href==='undefined'){destination='';}else{destination=(window.decodeURI)?window.decodeURI(element.href):element.href;}
console.log(target);data={timestamp:now.getTime(),type:type,destination:destination,origin:origin,target:target,attributes:sg_get_el_attributes(element.attributes),action:'sg_listen_clicks'};jQuery.ajax({url:sgclicks.ajax,type:'POST',dataType:'json',data:data,}).always(function(data){});while(now.getTime()<then){now=new Date();}}
function sg_get_el_attributes(attributes)
{var ret={};Array.prototype.slice.call(attributes).forEach(function(item){ret[item.name]=item.value;});return ret;}
function get_targeted_links(target,type)
{target=unescape(target);switch(type)
{case'class':get_target_classes(target,type);break;case'id':get_target_elementid(target,type);break;case'tagname':get_target_tagnames(target,type);break;case'attribute':get_target_attributes(target,type);break;}}
function get_target_classes(target,type)
{var links,link;if(document.getElementsByClassName)
{links=document.getElementsByClassName(target);for(var i=0;i<links.length;i++)
{var link=links[i];link.addEventListener('click',function(event){save_click(link,target,type);},false);}}}
function get_target_elementid(target,type)
{var element=document.getElementById(target);if(element)
{element.addEventListener('click',function(event){save_click(element,target,type);},false);}}
function get_target_tagnames(target,type)
{var element,allElements;allElements=document.getElementsByTagName(target);for(var i=0;(element=allElements[i])!==null;i++){if(typeof allElements[i]==='undefined'){}else{element.addEventListener('click',function(event){save_click(element,target,type);},false);}}}
function get_target_attributes(target,type)
{var elements=document.querySelectorAll('['+target+']');for(var i=0;i<elements.length;i++)
{var element=elements[i];if(typeof element==='undefined'){}else{element.addEventListener('click',function(event){save_click(element,target,type);},false);}}}