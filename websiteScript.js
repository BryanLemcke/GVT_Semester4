 (function(){
      const routes = ['esa1','esa2','esa3','esa4'];
      const loaded = new Set();
      const scriptMap = {
        esa1: 'esa1script.js',
        esa2: 'esa2script.js',
        esa3: 'esa3script.js',
        esa4: 'esa4script.js'
      };

      function setActiveTab(id){
        routes.forEach(r=>{
          const a = document.getElementById('tab-' + r);
          if (!a) return;
          if (r === id) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
        });
      }

      function show(id){
        routes.forEach(r=>{
          const sec = document.getElementById(r);
          if (!sec) return;
          if (r === id) sec.removeAttribute('hidden'); else sec.setAttribute('hidden','');
        });
        setActiveTab(id);
        if (!loaded.has(id) && scriptMap[id]) {
          const s = document.createElement('script');
          s.src = scriptMap[id];
          s.defer = true;
          s.onload = ()=> loaded.add(id);
          s.onerror = ()=> console.error('Konnte Script nicht laden:', scriptMap[id]);
          document.body.appendChild(s);
        }
      }

      function currentRoute(){
        const h = (location.hash || '').replace('#','').toLowerCase();
        return routes.includes(h) ? h : 'esa1';
      }
      window.addEventListener('hashchange', ()=> show(currentRoute()));
      show(currentRoute());
    })();