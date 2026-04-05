fetch('https://api.codex.jaagrav.in', {
  method: 'POST',
  headers: {
      'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      code: '#include <iostream>\\nusing namespace std;\\nint main() { cout << "Hello World" << endl; return 0; }',
      language: 'cpp',
      input: ''
  })
})
.then(response => response.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(error => console.error(error));
