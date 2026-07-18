export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        
    .replace(/&/g, '-and-')      
    .replace(/[^\w-]+/g, '')     
    .replace(/--+/g, '-');       
}