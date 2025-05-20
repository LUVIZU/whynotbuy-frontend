const input = document.getElementById("Input");
const list = document.getElementById("List");

function addTodo() {
  const text = input.value.trim();
  if (!text) {
    alert("할 일을 입력해주세요!");
    input.focus();
    return;
  }

  const li = document.createElement("li");

  const taskContent = document.createElement("div");
  taskContent.classList.add("task-content");

  const checkBtn = document.createElement("div");
  checkBtn.classList.add("check-btn");
  checkBtn.addEventListener("click", () => {
    checkBtn.classList.toggle("checked");
    taskSpan.classList.toggle("done");
  });

  const taskSpan = document.createElement("span");
  taskSpan.classList.add("task");
  taskSpan.textContent = text;

  taskContent.appendChild(checkBtn);
  taskContent.appendChild(taskSpan);

  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("delete-btn");
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", () => {
    list.removeChild(li);
  });

  li.appendChild(taskContent);
  li.appendChild(deleteBtn);

  list.appendChild(li);

  input.value = "";
  input.focus();
}
