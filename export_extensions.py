import argparse
import json
import os
import subprocess


def export_extensions(mode: str) -> None:
    """Export VSCode extensions to a file in the specified format.

    Args:
        mode (str): The format to export the extensions, either 'txt' or 'json'.
    """
    result = subprocess.run(["code", "--list-extensions"], capture_output=True, text=True)
    extensions = result.stdout.splitlines()

    if mode == "txt":
        with open("extensions.txt", "w") as f:
            f.write("\n".join(extensions))
            f.write("\n")
        print("✅ extensions.txt exported.")
    elif mode == "json":
        os.makedirs(".vscode", exist_ok=True)
        with open(".vscode/extensions.json", "w") as f:
            json.dump({"recommendations": extensions}, f, indent=2)
            f.write("\n")
        print("✅ .vscode/extensions.json exported.")
    else:
        print("❌ Invalid mode. Use 'txt' or 'json'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export VSCode extensions.")
    parser.add_argument("--mode", choices=["txt", "json"], required=True, help="Export format: txt or json")
    args = parser.parse_args()
    export_extensions(args.mode)
