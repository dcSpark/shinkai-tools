import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe("SystemHWInfoTool", () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it("should return valid system hardware information", async () => {
    const result = await client.executeToolFromFile(toolPath, {}, {});
    console.log(result);

    // CPU info checks
    expect(result).toHaveProperty("cpu_info");
    expect(result.cpu_info).toHaveProperty("physical_cores");
    expect(result.cpu_info).toHaveProperty("logical_cores");
    expect(result.cpu_info).toHaveProperty("frequency");
    expect(result.cpu_info).toHaveProperty("architecture");
    expect(result.cpu_info).toHaveProperty("processor_brand");
    expect(result.cpu_info).toHaveProperty("cpu_usage_percent");
    
    expect(typeof result.cpu_info.physical_cores).toBe("number");
    expect(typeof result.cpu_info.logical_cores).toBe("number");
    expect(typeof result.cpu_info.cpu_usage_percent).toBe("number");
    
    expect(result.cpu_info.frequency).toHaveProperty("current_mhz");
    expect(result.cpu_info.frequency).toHaveProperty("min_mhz");
    expect(result.cpu_info.frequency).toHaveProperty("max_mhz");
    
    // Memory info checks
    expect(result).toHaveProperty("memory_info");
    expect(result.memory_info).toHaveProperty("total_bytes");
    expect(result.memory_info).toHaveProperty("available_bytes");
    expect(result.memory_info).toHaveProperty("used_bytes");
    expect(result.memory_info).toHaveProperty("percent_used");
    expect(result.memory_info).toHaveProperty("swap");
    
    expect(typeof result.memory_info.total_bytes).toBe("number");
    expect(typeof result.memory_info.available_bytes).toBe("number");
    expect(typeof result.memory_info.used_bytes).toBe("number");
    expect(typeof result.memory_info.percent_used).toBe("number");
    expect(result.memory_info.total_bytes).toBeGreaterThan(0);
    
    expect(result.memory_info.swap).toHaveProperty("total_bytes");
    expect(result.memory_info.swap).toHaveProperty("used_bytes");
    expect(result.memory_info.swap).toHaveProperty("free_bytes");
    expect(result.memory_info.swap).toHaveProperty("percent_used");
    
    // Disk info checks
    expect(result).toHaveProperty("disk_info");
    expect(result.disk_info).toHaveProperty("total_bytes");
    expect(result.disk_info).toHaveProperty("used_bytes");
    expect(result.disk_info).toHaveProperty("free_bytes");
    expect(result.disk_info).toHaveProperty("percent_used");
    expect(result.disk_info).toHaveProperty("file_system_type");
    
    expect(typeof result.disk_info.total_bytes).toBe("number");
    expect(typeof result.disk_info.used_bytes).toBe("number");
    expect(typeof result.disk_info.free_bytes).toBe("number");
    expect(typeof result.disk_info.percent_used).toBe("number");
    expect(result.disk_info.total_bytes).toBeGreaterThan(0);

    // GPU info checks
    expect(result).toHaveProperty("gpu_info");
    expect(Array.isArray(result.gpu_info)).toBe(true);
    expect(result.gpu_info.length).toBeGreaterThan(0);
    
    const gpu = result.gpu_info[0];
    expect(gpu).toHaveProperty("name");
    expect(typeof gpu.name).toBe("string");
    expect(gpu.name.length).toBeGreaterThan(0);

    // System info checks
    expect(result).toHaveProperty("system_info");
    expect(result.system_info).toHaveProperty("os_name");
    expect(result.system_info).toHaveProperty("os_version");
    expect(result.system_info).toHaveProperty("os_release");
    expect(result.system_info).toHaveProperty("computer_name");
    expect(result.system_info).toHaveProperty("machine_type");
    expect(result.system_info).toHaveProperty("boot_time");
    
    expect(typeof result.system_info.os_name).toBe("string");
    expect(typeof result.system_info.os_version).toBe("string");
    expect(typeof result.system_info.os_release).toBe("string");
    expect(typeof result.system_info.computer_name).toBe("string");
    expect(typeof result.system_info.machine_type).toBe("string");
    expect(typeof result.system_info.boot_time).toBe("number");
  });

  it("should have consistent disk space calculations", async () => {
    const result = await client.executeToolFromFile(toolPath, {}, {});
    
    const { total_bytes, used_bytes, free_bytes } = result.disk_info;
    // Check that disk space values are reasonable
    expect(total_bytes).toBeGreaterThan(0);
    expect(used_bytes).toBeGreaterThan(0);
    expect(free_bytes).toBeGreaterThan(0);
    // Total should be greater than or equal to used + free (some space may be reserved)
    expect(total_bytes).toBeGreaterThanOrEqual(used_bytes + free_bytes);
  });
});
