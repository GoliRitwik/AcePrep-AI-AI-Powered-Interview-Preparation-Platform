import React from "react";
import { createBrowserRouter, Outlet } from "react-router";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";
import Home from "./features/interview/pages/Home";
import Interview from "./features/interview/pages/Interview";
import Plans from "./features/interview/pages/Plans";
import MockInterview from "./features/interview/pages/MockInterview";
import HistoryPage from "./features/interview/pages/HistoryPage";
import Navbar from "./components/Navbar/Navbar";

// Main layout providing the persistent top Navbar
const RootLayout = () => {
    return (
        <>
            <Navbar />
            <Outlet />
        </>
    )
}

export const router = createBrowserRouter([
    {
        element: <RootLayout />,
        children: [
            {
                path: "/",
                element: <Protected><Home /></Protected>
            },
            {
                path: "/history",
                element: <Protected><HistoryPage /></Protected>
            },
            {
                path: "/plans",
                element: <Protected><Plans /></Protected>
            },
            {
                path: "/interview/:interviewId",
                element: <Protected><Interview /></Protected>
            },
            {
                path: "/report/:id",
                element: <Protected><Interview /></Protected>
            },
            {
                path: "/mock-interview/:reportId",
                element: <Protected><MockInterview /></Protected>
            },
            {
                path: "/login",
                element: <Login />
            },
            {
                path: "/register",
                element: <Register />
            }
        ]
    }
])
