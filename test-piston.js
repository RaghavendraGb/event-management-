  fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'cpp',
      version: '10.2.0',
      files: [{ name: 'main.cpp', content: '#include <iostream>\nusing namespace std;\nint main() { cout << "Hello World" << endl; return 0; }' }],
      stdin: '',
      run_timeout: 3000
    })
  }).then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2)));
