fetch('https://wandbox.org/api/compilers.json')
  .then(res => res.json())
  .then(data => {
    const cxx = data.filter(c => c.language === 'C++');
    console.log(cxx.map(c => c.name).slice(0, 10));
  });
