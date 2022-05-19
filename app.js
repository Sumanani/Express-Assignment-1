const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { format, isValid } = require("date-fns");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "todoApplication.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at https://localhost/3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const formatTodo = (todoItem) => ({
  id: todoItem.id,
  priority: todoItem.priority,
  todo: todoItem.todo,
  status: todoItem.status,
  category: todoItem.category,
  dueDate: todoItem.due_date,
});

//Initial Values
const priorityConstants = ["HIGH", "MEDIUM", "LOW"];
const statusConstants = ["TO DO", "IN PROGRESS", "DONE"];
const categoryConstants = ["WORK", "HOME", "LEARNING"];

const checkStatus = (requestQuery) => {
  return statusConstants.includes(requestQuery.status);
};
const checkPriority = (requestQuery) => {
  return priorityConstants.includes(requestQuery.priority);
};
const checkCategory = (requestQuery) => {
  return categoryConstants.includes(requestQuery.category);
};
const checkDate = (date) => {
  return isValid(new Date(date));
};

//Get Todo API
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
    SELECT
      * 
    FROM
      todo
    WHERE 
      id = ${todoId};`;

  const todo = await db.get(getTodoQuery);
  const newTodo = formatTodo(todo);
  response.send(newTodo);
});

//Delete Todo API
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `
    DELETE FROM 
      todo
    WHERE
      id = ${todoId};`;

  await db.run(deleteTodoQuery);
  response.send("Todo Deleted");
});

//Update Todo API
app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  let updateColumn = "";
  let isValid = true;
  let check = true;
  const previousTodoQuery = `
    SELECT
      *
    FROM
      todo
    WHERE
      id = ${todoId};`;
  const previousTodo = await db.get(previousTodoQuery);

  const {
    status = previousTodo.status,
    priority = previousTodo.priority,
    todo = previousTodo.todo,
    category = previousTodo.category,
    dueDate = previousTodo.due_date,
  } = request.body;

  const updateTodoQuery = `
  UPDATE todo
  SET
    status = '${status}',
    priority = '${priority}',
    todo = '${todo}',
    category = '${category}',
    due_date = '${dueDate}'
  WHERE
    id = ${todoId};`;

  switch (true) {
    case request.body.status !== undefined:
      isValid = checkStatus(request.body);
      updateColumn = "Status";
      break;
    case request.body.priority !== undefined:
      isValid = checkPriority(request.body);
      updateColumn = "Priority";
      break;
    case request.body.category !== undefined:
      isValid = checkCategory(request.body);
      updateColumn = "Category";
      break;
    case request.body.todo !== undefined:
      updateColumn = "Todo";
      break;
    case request.body.dueDate !== undefined:
      check = checkDate(request.body.dueDate);
      isValid = check;
      updateColumn = "Due Date";
      break;
  }

  if (isValid) {
    await db.run(updateTodoQuery);
    response.send(`${updateColumn} Updated`);
  } else {
    response.status(400);
    if (check) {
      response.send(`Invalid Todo ${updateColumn}`);
    } else {
      response.send("Invalid Due Date");
    }
  }
});

//Add Todo API
app.post("/todos/", async (request, response) => {
  let isValid = true;
  let updateColumn = "";
  let check = true;

  switch (true) {
    case !checkCategory(request.body):
      updateColumn = "Category";
      break;
    case !checkStatus(request.body):
      updateColumn = "Status";
      break;
    case !checkPriority(request.body):
      updateColumn = "Priority";
      break;
  }

  check = checkDate(request.body.dueDate);
  isValid =
    checkCategory(request.body) &&
    checkStatus(request.body) &&
    checkPriority(request.body) &&
    check;

  if (isValid) {
    const { id, todo, priority, category, dueDate, status } = request.body;
    const addTodoQuery = `
    INSERT INTO
      todo (id, todo, priority, status, category, due_date)
    VALUES(
        ${id}, '${todo}', '${priority}', '${status}', '${category}', '${dueDate}');`;
    await db.run(addTodoQuery);
    response.send("Todo Successfully Added");
  } else {
    response.status(400);
    if (check) {
      response.send(`Invalid Todo ${updateColumn}`);
    } else {
      response.send("Invalid Due Date");
    }
  }
});

//Get Todo by query

const hasStatusAndPriorityProperties = (requestQuery) => {
  return (
    requestQuery.status !== undefined && requestQuery.priority !== undefined
  );
};

const hasStatusAndCategoryProperties = (requestQuery) => {
  return (
    requestQuery.status !== undefined && requestQuery.category !== undefined
  );
};

const hasCategoryAndPriorityProperties = (requestQuery) => {
  return (
    requestQuery.category !== undefined && requestQuery.priority !== undefined
  );
};

const hasStatusProperty = (requestQuery) => {
  return requestQuery.status !== undefined;
};

const hasPriorityProperty = (requestQuery) => {
  return requestQuery.priority !== undefined;
};

const hasCategoryProperty = (requestQuery) => {
  return requestQuery.category !== undefined;
};

app.get("/todos/", async (request, response) => {
  let todosQuery = "";
  let isValid = true;
  let updateColumn = "";
  const { search_q = "", status, priority, category } = request.query;

  switch (true) {
    case hasStatusAndPriorityProperties(request.query):
      isValid = checkStatus(request.query) && checkPriority(request.query);
      if (!checkStatus(request.query)) {
        updateColumn = "Status";
      } else if (!checkPriority(request.query)) {
        updateColumn = "Priority";
      }
      todosQuery = `
            SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%'
            AND status = '${status}'
            AND priority = '${priority}';`;
      break;

    case hasStatusAndCategoryProperties(request.query):
      isValid = checkStatus(request.query) && checkCategory(request.query);
      if (!checkStatus(request.query)) {
        updateColumn = "Status";
      } else if (!checkCategory(request.query)) {
        updateColumn = "Category";
      }
      todosQuery = `
            SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%'
            AND status = '${status}'
            AND category = '${category}';`;
      break;

    case hasCategoryAndPriorityProperties(request.query):
      isValid = checkCategory(request.query) && checkPriority(request.query);
      if (!checkCategory(request.query)) {
        updateColumn = "Category";
      } else if (!checkPriority(request.query)) {
        updateColumn = "Priority";
      }
      todosQuery = `
            SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%'
            AND category = '${category}'
            AND priority = '${priority}';`;
      break;

    case hasStatusProperty(request.query):
      isValid = checkStatus(request.query);
      if (!checkStatus(request.query)) {
        updateColumn = "Status";
      }
      todosQuery = `
        SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%'
            AND status = '${status}';`;
      break;

    case hasPriorityProperty(request.query):
      isValid = checkPriority(request.query);
      if (!checkPriority(request.query)) {
        updateColumn = "Priority";
      }
      todosQuery = `
        SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%'
            AND priority = '${priority}';`;
      break;

    case hasCategoryProperty(request.query):
      isValid = checkCategory(request.query);
      if (!checkCategory(request.query)) {
        updateColumn = "Category";
      }
      todosQuery = `
        SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%'
            AND category = '${category}';`;
      break;
    default:
      todosQuery = `
            SELECT
              *
            FROM
              todo
            WHERE
              todo LIKE '%${search_q}%';`;
  }

  if (isValid) {
    const data = await db.all(todosQuery);
    const formattedData = data.map((each) => formatTodo(each));
    response.send(formattedData);
  } else {
    response.status(400);
    response.send(`Invalid Todo ${updateColumn}`);
  }
});

//Get Todo by Date Api
app.get("/agenda/", async (request, response) => {
  const { date } = request.query;
  const check = checkDate(date);
  if (check) {
    const formattedDate = format(new Date(date), "yyyy-MM-dd");
    getTodoQuery = `
    SELECT
      *
    FROM
      todo
    WHERE
      due_date = '${formattedDate}';`;

    const data = await db.all(getTodoQuery);
    const formattedData = data.map((each) => formatTodo(each));
    response.send(formattedData);
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
});

module.exports = app;
