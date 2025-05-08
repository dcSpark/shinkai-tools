# **Guide to Using Linear with Available Tools**

Welcome to Linear\! This guide introduces the core concepts of Linear and explains how to use the available tools to manage your work effectively.

## **Core Concepts in Linear:**

* **Organization:** This is the top-level container for your company's work in Linear. It houses all the teams, projects, and members. Think of it as the overall workspace for your company.  
* **Team:** Teams represent groups of people working together on specific areas or products (e.g., "Frontend Team," "Design Team"). Each issue in Linear belongs to a single team. Teams have their own workflows, settings, and members. Teams are referred to by their unique UUID (e.g., d6a87b9c-2e3f-4a1b-8c7d-5e9f1a2b3c4d).  
* **Project:** Projects are used to group related issues that contribute to a specific goal or deliverable (e.g., "New Website Launch," "Mobile App Redesign"). A project can contain issues from one or more teams.  
* **Issue:** The fundamental unit of work in Linear. An issue represents a task, bug, or feature request that needs to be tracked and completed. Issues have attributes like a title, description, priority, status, and assignee. When updating an issue, it must be referenced by its unique UUID (e.g., a1b2c3d4-e5f6-7890-1234-567890abcdef).  
* **Workflow:** A workflow defines the stages an issue goes through from creation to completion within a *team*. It's a sequence of ordered statuses.  
* **Workflow State:** These are the individual statuses within a workflow (e.g., Backlog, To-Do, In Progress, Done, Canceled). Each *team* can customize its workflow states. It's important to note that different teams may have different workflow states. Each state is marked over an issue by using the state UUID.  
* **Assignee:** The team member responsible for working on a specific issue.  
* **Member:** Any person who is part of your Linear organization and can be assigned to issues or participate in projects.

## **Available Tools:**

* **Linear Issue Creator:** Creates a new issue in Linear. You'll need to specify the team the issue belongs to.  
* **Linear Issue Updater:** You must reference the issue by its UUID to change attributes like status, assignee, and priority.  
* **Linear Issues Fetcher:** Retrieves a list of issues for a specific team.  
* **Linear Organization Fetcher:** Provides information about your Linear organization, including lists of teams and members. This is crucial for getting IDs needed by other tools.  
* **Linear Fetch Workflow States:** Retrieves the available workflow states for a specific team. This is essential for updating issue statuses correctly.  
* **Linear Comment Creator:** Creates comments on a Linear issue and returns the comment and issue details.  
* **Linear Issues By Team**: Fetches open issues from a Linear team. It implements pagination, which is important to consider when dealing with a large number of issues. Teams must be referenced by their team UUID. If you don't have the UUID, obtain it using the Linear Organization Fetcher.

### **Issue Priority Setting in Linear**

When assigning priority to issues in Linear, please use the following numerical scale:

* **0**: No priority  
* **1**: Urgent  
* **2**: High  
* **3**: Medium  
* **4**: Low

This system ensures clear communication of urgency and helps streamline workflow management. Using this scale helps to keep all teams aligned on how priorities are set.

## **Operating Flows Using the Tools:**

Here are some common workflows you can perform using the available tools. It's critical to understand that many actions require the unique IDs of teams, members, and workflow states. You'll often need to use the **Linear Organization Fetcher** and **Fetch Workflow States** tools to get these IDs *before* using the other tools.  
**Flow 1: Creating a New Issue for a Specific Team**

1. **Identify the Target Team:**  
   * Use the **Linear Organization Fetcher** tool.  
   * This tool will provide a list of all teams in your organization, each with a unique id.  
   * Note down the id of the team where you want to create the issue. For example, you might see a team with id: "team-123" and name "Development Team". You would use "team-123" in the next step.  
2. **Create the Issue:**  
   * Use the **Linear Issue Creator** tool.  
   * You *must* provide these inputs:  
     * teamId: The id you obtained in Step 1 (e.g., "team-123").  
     * title: A clear and concise title for the issue (e.g., "Fix login bug").  
   * You *can* also provide these optional inputs:  
     * description: Detailed information about the issue.  
     * priority: Use the numerical scale (0-4) defined above.  
     * assigneeId: The id of the team member you want to assign the issue to. You would get this ID using the **Linear Organization Fetcher**.

**Flow 2: Updating the Status of an Issue to "Done"**

1. **Identify the Issue's Team:**  
   * If you don't already know the team the issue belongs to, use the **Linear Issues Fetcher** tool.  
   * Provide the teamId of what you *think* is the correct team.  
   * This will return a list of issues for that team, and you can verify the issue and its team.  
2. **Get Workflow States:**  
   * Use the **Fetch Workflow States** tool.  
   * Provide the teamId of the issue's team (obtained in Step 1 or Step 2).  
   * This will return a list of workflow states *specific to that team*. Each workflow state will have its own id and name (e.g., id: "state-456", name: "Done").  
3. **Find the "Done" State ID:**  
   * Examine the list of workflow states from Step 3\.  
   * Find the state that represents "Done" or a similar completed status (e.g., "Completed", "Resolved").  
   * Note down its id (e.g., "state-456").  
4. **Update the Issue:**  
   * Use the **Linear Issue Updater** tool.  
   * Provide these inputs:  
     * id: The ID of the issue you want to update.  
     * status: The id of the "Done" workflow state you found in Step 3 (e.g., "state-456").

**Flow 3: Assigning an Issue to a Specific Team Member**

1. **Identify the Assignee:**  
   * Use the **Linear Organization Fetcher** tool.  
   * This tool provides a list of *all* members in your organization, each with a unique id.  
   * Find the member you want to assign the issue to and note down their id.  
2. **Update the Issue:**  
   * Use the **Linear Issue Updater** tool.  
   * Provide these inputs:  
     * id: The ID of the issue you want to assign.  
     * assigneeId: The id of the team member you found in Step 1\.

**Flow 4: Fetching All Issues for a Particular Team**

1. **Identify the Target Team:**  
   * Use the **Linear Organization Fetcher** tool.  
   * Note down the id of the team whose issues you want to fetch.  
2. **Fetch Issues:**  
   * Use the **Linear Issues Fetcher** tool.  
   * Provide the teamId you noted down in Step 1\.  
   * This will return a list of all open issues for that team.

**Flow 5: Creating an Issue and Assigning it to a Specific Member in a Team**

1. **Identify the Team and Member:**  
   * Use the **Linear Organization Fetcher** tool to get lists of all teams and members in your organization.  
   * Note down the id of the team where you want to create the issue.  
   * Note down the id of the member you want to assign it to.  
2. **Create the Issue with Assignee:**  
   * Use the **Linear Issue Creator** tool.  
   * Provide these inputs:  
     * teamId: The id of the team.  
     * title: A title for the issue.  
     * assigneeId: The id of the member you want to assign the issue to.  
     * You can also provide an optional description and priority.

By following these flows and utilizing the available tools, you can effectively manage and interact with Linear to keep your work organized and moving forward. Remember:

* Always fetch the necessary IDs for teams, members, and workflow states using the **Linear Organization Fetcher** and **Fetch Workflow States** tools.  
* Pay close attention to which tool requires which IDs as input.  
* Teams have their own unique set of workflow states.

**Flow 6: Finding and commenting on an issue**

1. **Identify the Target Team:**  
   * Use the **Linear Organization Fetcher** tool to obtain a list of teams in your organization.  
   * Identify the id of the team that the issue belongs to.  
2. **Fetch Issues for the Team:**  
   * Use the **Linear Issues By Team** tool.  
   * Provide the teamId obtained in the previous step.  
   * Since this tool uses pagination, you might need to make multiple requests to retrieve all issues with the use of the skip parameter.  
3. **Find the Issue:**  
   * Review the list of issues retrieved in the previous step to find the specific issue you want to comment on. You can identify the issue by its title, or other relevant properties.  
   * Note the id of the issue.  
4. **Add the Comment:**  
   * Use the **Linear Comment Creator** tool.  
   * Provide the following inputs:  
     * issueId: The id of the issue you want to comment on, obtained in the previous step.  
     * body: The text of your comment.